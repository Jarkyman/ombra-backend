use std::path::PathBuf;
use std::sync::mpsc::Receiver;

use crossterm::event::{KeyCode, KeyEvent, KeyModifiers};
use ombra_common::config::RemoteAccessMode;
use ombra_common::hardware::HardwareProfile;
use ratatui::widgets::ListState;

#[derive(Debug, Clone, PartialEq)]
pub enum Step {
    Welcome,
    ModelSelect,
    LanguageInput,
    ConnectionModeSelect,
    RemoteTokenInput,
    RemoteSubdomainInput,
    TailscaleCheck,
    Starting,
    OnboardingName,
    OnboardingOccupation,
    OnboardingLocation,
    OnboardingPeople,
    OnboardingProjects,
    OnboardingAdditional,
    Waiting,
    Done,
}

#[derive(Debug, Clone)]
pub enum TailscaleStatus {
    NotInstalled,
    NotLoggedIn,
    Connected { ip: String },
}

pub struct ConnectionModeEntry {
    pub mode: Option<RemoteAccessMode>,
    pub label: &'static str,
    pub description: &'static str,
}

pub const CONNECTION_MODES: &[ConnectionModeEntry] = &[
    ConnectionModeEntry {
        mode: Some(RemoteAccessMode::LocalOnly),
        label: "Local only",
        description: "LAN + ombra.local  ·  no setup required",
    },
    ConnectionModeEntry {
        mode: Some(RemoteAccessMode::DuckDns),
        label: "DuckDNS",
        description: "Free DDNS + Let's Encrypt  ·  requires router port-forward",
    },
    ConnectionModeEntry {
        mode: Some(RemoteAccessMode::Tailscale),
        label: "Tailscale",
        description: "Zero-config VPN  ·  no port-forward needed",
    },
    ConnectionModeEntry {
        mode: None,
        label: "OmbraDNS",
        description: "(coming soon)",
    },
    ConnectionModeEntry {
        mode: None,
        label: "ZeroTier",
        description: "(coming soon)",
    },
    ConnectionModeEntry {
        mode: None,
        label: "Cloudflare Tunnel",
        description: "(coming soon)",
    },
    ConnectionModeEntry {
        mode: None,
        label: "Remote.It",
        description: "(coming soon)",
    },
    ConnectionModeEntry {
        mode: None,
        label: "ngrok",
        description: "(coming soon)",
    },
    ConnectionModeEntry {
        mode: None,
        label: "packetriot",
        description: "(coming soon)",
    },
];

#[derive(Debug, Default, Clone)]
pub struct OnboardingAnswers {
    pub name: String,
    pub occupation: String,
    pub location: String,
    pub important_people: String,
    pub current_projects: String,
    pub additional: String,
}

#[derive(Debug, Default, Clone, PartialEq)]
pub enum TaskStatus {
    #[default]
    Pending,
    Running,
    Done,
    Failed(String),
}

#[derive(Debug, Default, Clone)]
pub struct ModelDownloadProgress {
    pub status: TaskStatus,
    pub downloaded_bytes: u64,
    pub total_bytes: u64,
}

impl ModelDownloadProgress {
    pub fn fraction(&self) -> f64 {
        if self.total_bytes == 0 {
            return 0.0;
        }
        (self.downloaded_bytes as f64 / self.total_bytes as f64).clamp(0.0, 1.0)
    }
}

#[derive(Debug, Default, Clone)]
pub struct BackgroundProgress {
    pub qdrant: TaskStatus,
    pub model: ModelDownloadProgress,
    pub build: TaskStatus,
}

impl BackgroundProgress {
    pub fn all_done(&self) -> bool {
        self.qdrant == TaskStatus::Done
            && self.model.status == TaskStatus::Done
            && self.build == TaskStatus::Done
    }
}

#[derive(Debug)]
pub enum BackgroundEvent {
    QdrantReady,
    QdrantFailed(String),
    ModelProgress { downloaded: u64, total: u64 },
    ModelReady,
    ModelFailed(String),
    BuildReady,
    BuildFailed(String),
}

pub const PROFILES: [HardwareProfile; 4] = [
    HardwareProfile::Nano,
    HardwareProfile::Edge,
    HardwareProfile::Efficiency,
    HardwareProfile::Performance,
];

pub struct App {
    pub step: Step,
    pub input: String,
    pub install_dir: PathBuf,
    pub detected_profile: HardwareProfile,
    pub list_state: ListState,
    pub connection_mode: RemoteAccessMode,
    pub ddns_token: String,
    pub ddns_subdomain: String,
    pub tailscale_status: Option<TailscaleStatus>,
    pub language: String,
    pub onboarding: OnboardingAnswers,
    pub progress: BackgroundProgress,
    pub bg_rx: Receiver<BackgroundEvent>,
    pub setup_triggered: bool,
    pub finalize_triggered: bool,
    pub error: Option<String>,
    pub should_quit: bool,
}

impl App {
    pub fn new(detected: HardwareProfile, rx: Receiver<BackgroundEvent>, install_dir: PathBuf) -> Self {
        let default_idx = PROFILES
            .iter()
            .position(|p| std::mem::discriminant(p) == std::mem::discriminant(&detected))
            .unwrap_or(2);

        let mut list_state = ListState::default();
        list_state.select(Some(default_idx));

        Self {
            step: Step::Welcome,
            input: String::new(),
            install_dir,
            detected_profile: detected,
            list_state,
            connection_mode: RemoteAccessMode::LocalOnly,
            ddns_token: String::new(),
            ddns_subdomain: String::new(),
            tailscale_status: None,
            language: "en".to_string(),
            onboarding: OnboardingAnswers::default(),
            progress: BackgroundProgress::default(),
            bg_rx: rx,
            setup_triggered: false,
            finalize_triggered: false,
            error: None,
            should_quit: false,
        }
    }

    pub fn selected_profile(&self) -> HardwareProfile {
        let idx = self.list_state.selected().unwrap_or(2);
        PROFILES[idx.clamp(0, PROFILES.len() - 1)].clone()
    }

    pub fn poll_background(&mut self) {
        while let Ok(event) = self.bg_rx.try_recv() {
            match event {
                BackgroundEvent::QdrantReady => {
                    self.progress.qdrant = TaskStatus::Done;
                }
                BackgroundEvent::QdrantFailed(e) => {
                    self.progress.qdrant = TaskStatus::Failed(e);
                }
                BackgroundEvent::ModelProgress { downloaded, total } => {
                    self.progress.model.downloaded_bytes = downloaded;
                    self.progress.model.total_bytes = total;
                    self.progress.model.status = TaskStatus::Running;
                }
                BackgroundEvent::ModelReady => {
                    self.progress.model.status = TaskStatus::Done;
                    self.progress.model.downloaded_bytes = self.progress.model.total_bytes;
                }
                BackgroundEvent::ModelFailed(e) => {
                    self.progress.model.status = TaskStatus::Failed(e);
                }
                BackgroundEvent::BuildReady => {
                    self.progress.build = TaskStatus::Done;
                }
                BackgroundEvent::BuildFailed(e) => {
                    self.progress.build = TaskStatus::Failed(e);
                }
            }
        }
    }

    pub fn handle_key(&mut self, key: KeyEvent) {
        if key.modifiers.contains(KeyModifiers::CONTROL) && key.code == KeyCode::Char('c') {
            self.should_quit = true;
            return;
        }

        match &self.step {
            Step::Welcome => {
                if key.code == KeyCode::Enter {
                    self.step = Step::ModelSelect;
                }
            }

            Step::ModelSelect => match key.code {
                KeyCode::Up => {
                    let i = self.list_state.selected().unwrap_or(0);
                    self.list_state.select(Some(i.saturating_sub(1)));
                }
                KeyCode::Down => {
                    let i = self.list_state.selected().unwrap_or(0);
                    self.list_state.select(Some((i + 1).min(PROFILES.len() - 1)));
                }
                KeyCode::Enter => {
                    self.input = "en".to_string();
                    self.step = Step::LanguageInput;
                }
                _ => {}
            },

            Step::LanguageInput => match key.code {
                KeyCode::Enter => {
                    if self.input.trim().is_empty() {
                        self.language = "en".to_string();
                    } else {
                        self.language = self.input.trim().to_lowercase();
                    }
                    self.input.clear();
                    self.list_state.select(Some(0));
                    self.step = Step::ConnectionModeSelect;
                }
                KeyCode::Backspace => {
                    self.input.pop();
                }
                KeyCode::Char(c) if self.input.len() < 5 => {
                    self.input.push(c);
                }
                _ => {}
            },

            Step::ConnectionModeSelect => match key.code {
                KeyCode::Up => {
                    let i = self.list_state.selected().unwrap_or(0);
                    let prev = (0..i)
                        .rev()
                        .find(|&j| CONNECTION_MODES[j].mode.is_some())
                        .unwrap_or(i);
                    self.list_state.select(Some(prev));
                }
                KeyCode::Down => {
                    let i = self.list_state.selected().unwrap_or(0);
                    let next = (i + 1..CONNECTION_MODES.len())
                        .find(|&j| CONNECTION_MODES[j].mode.is_some())
                        .unwrap_or(i);
                    self.list_state.select(Some(next));
                }
                KeyCode::Enter => {
                    let i = self.list_state.selected().unwrap_or(0);
                    match CONNECTION_MODES[i].mode {
                        Some(RemoteAccessMode::LocalOnly) => {
                            self.connection_mode = RemoteAccessMode::LocalOnly;
                            self.step = Step::Starting;
                        }
                        Some(RemoteAccessMode::DuckDns) => {
                            self.connection_mode = RemoteAccessMode::DuckDns;
                            self.input.clear();
                            self.step = Step::RemoteTokenInput;
                        }
                        Some(RemoteAccessMode::Tailscale) => {
                            self.connection_mode = RemoteAccessMode::Tailscale;
                            self.tailscale_status = None;
                            self.step = Step::TailscaleCheck;
                        }
                        _ => {}
                    }
                }
                _ => {}
            },

            Step::RemoteTokenInput => match key.code {
                KeyCode::Enter => {
                    self.ddns_token = self.input.trim().to_string();
                    self.input.clear();
                    self.step = Step::RemoteSubdomainInput;
                }
                KeyCode::Backspace => {
                    self.input.pop();
                }
                KeyCode::Char(c) => {
                    self.input.push(c);
                }
                _ => {}
            },

            Step::RemoteSubdomainInput => match key.code {
                KeyCode::Enter => {
                    self.ddns_subdomain = self.input.trim().to_string();
                    self.input.clear();
                    self.step = Step::Starting;
                }
                KeyCode::Backspace => {
                    self.input.pop();
                }
                KeyCode::Char(c) => {
                    self.input.push(c);
                }
                _ => {}
            },

            Step::TailscaleCheck => {
                if key.code == KeyCode::Enter {
                    self.step = Step::Starting;
                }
            }

            Step::Starting => {}

            Step::OnboardingName => self.handle_onboarding_key(key, |app| {
                app.onboarding.name = app.input.trim().to_string();
                app.step = Step::OnboardingOccupation;
            }),
            Step::OnboardingOccupation => self.handle_onboarding_key(key, |app| {
                app.onboarding.occupation = app.input.trim().to_string();
                app.step = Step::OnboardingLocation;
            }),
            Step::OnboardingLocation => self.handle_onboarding_key(key, |app| {
                app.onboarding.location = app.input.trim().to_string();
                app.step = Step::OnboardingPeople;
            }),
            Step::OnboardingPeople => self.handle_onboarding_key(key, |app| {
                app.onboarding.important_people = app.input.trim().to_string();
                app.step = Step::OnboardingProjects;
            }),
            Step::OnboardingProjects => self.handle_onboarding_key(key, |app| {
                app.onboarding.current_projects = app.input.trim().to_string();
                app.step = Step::OnboardingAdditional;
            }),
            Step::OnboardingAdditional => self.handle_onboarding_key(key, |app| {
                app.onboarding.additional = app.input.trim().to_string();
                if app.progress.all_done() {
                    app.step = Step::Done;
                } else {
                    app.step = Step::Waiting;
                }
            }),

            Step::Waiting => {}

            Step::Done => {
                if key.code == KeyCode::Enter || key.code == KeyCode::Char('q') {
                    self.should_quit = true;
                }
            }
        }
    }

    fn handle_onboarding_key<F>(&mut self, key: KeyEvent, on_enter: F)
    where
        F: FnOnce(&mut App),
    {
        match key.code {
            KeyCode::Enter => {
                on_enter(self);
                self.input.clear();
            }
            KeyCode::Backspace => {
                self.input.pop();
            }
            KeyCode::Char(c) => {
                self.input.push(c);
            }
            _ => {}
        }
    }

    pub fn onboarding_progress(&self) -> (usize, usize) {
        let current = match self.step {
            Step::OnboardingName => 1,
            Step::OnboardingOccupation => 2,
            Step::OnboardingLocation => 3,
            Step::OnboardingPeople => 4,
            Step::OnboardingProjects => 5,
            Step::OnboardingAdditional => 6,
            _ => 0,
        };
        (current, 6)
    }
}
