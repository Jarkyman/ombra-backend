use ratatui::{
    Frame,
    layout::{Alignment, Constraint, Layout, Rect},
    style::{Color, Modifier, Style},
    text::{Line, Span},
    widgets::{Block, BorderType, Borders, Gauge, List, ListItem, Padding, Paragraph, Wrap},
};

use ombra_common::hardware::HardwareProfile;

use ombra_common::config::RemoteAccessMode;

use crate::install::state::{App, Step, TaskStatus, TailscaleStatus, CONNECTION_MODES, PROFILES};

const PURPLE: Color = Color::Rgb(138, 99, 210);
const PURPLE_DIM: Color = Color::Rgb(80, 55, 130);
const WHITE: Color = Color::White;
const DIM: Color = Color::DarkGray;
const GREEN: Color = Color::Green;
const YELLOW: Color = Color::Yellow;
const RED: Color = Color::Red;
const BLUE: Color = Color::Rgb(100, 130, 210);

pub fn render(f: &mut Frame, app: &mut App) {
    let area = f.area();

    let layout = Layout::vertical([
        Constraint::Length(3),
        Constraint::Min(0),
        Constraint::Length(3),
    ])
    .split(area);

    render_title_bar(f, layout[0], app);
    render_content(f, layout[1], app);
    render_hint_bar(f, layout[2], app);
}

fn render_title_bar(f: &mut Frame, area: Rect, app: &App) {
    let step_label = match app.step {
        Step::Welcome | Step::Done => String::new(),
        Step::ModelSelect => "  Step 1 of 4  Model".to_string(),
        Step::LanguageInput => "  Step 2 of 4  Language".to_string(),
        Step::ConnectionModeSelect
        | Step::RemoteTokenInput
        | Step::RemoteSubdomainInput
        | Step::TailscaleCheck => "  Step 3 of 4  Connection".to_string(),
        Step::Starting
        | Step::OnboardingName
        | Step::OnboardingOccupation
        | Step::OnboardingLocation
        | Step::OnboardingPeople
        | Step::OnboardingProjects
        | Step::OnboardingAdditional
        | Step::Waiting => "  Step 4 of 4  Setup".to_string(),
    };

    let title = Line::from(vec![
        Span::styled("  OMBRA", Style::default().fg(PURPLE).add_modifier(Modifier::BOLD)),
        Span::styled(step_label, Style::default().fg(DIM)),
    ]);

    let block = Block::default()
        .borders(Borders::BOTTOM)
        .border_style(Style::default().fg(PURPLE_DIM));

    let para = Paragraph::new(title)
        .block(block)
        .alignment(Alignment::Left);

    f.render_widget(para, area);
}

fn render_hint_bar(f: &mut Frame, area: Rect, app: &App) {
    let hints = match app.step {
        Step::Welcome => "Enter  begin",
        Step::ModelSelect => "↑↓  navigate    Enter  confirm",
        Step::LanguageInput => "Enter  confirm",
        Step::ConnectionModeSelect => "↑↓  navigate    Enter  select",
        Step::RemoteTokenInput | Step::RemoteSubdomainInput => "Enter  confirm",
        Step::TailscaleCheck => "Enter  continue",
        Step::Starting => "",
        Step::OnboardingName
        | Step::OnboardingOccupation
        | Step::OnboardingLocation
        | Step::OnboardingPeople
        | Step::OnboardingProjects
        | Step::OnboardingAdditional => "Enter  continue    leave blank to skip",
        Step::Waiting => "Please wait...",
        Step::Done => "Enter  exit",
    };

    let line = Line::from(Span::styled(
        format!("  {hints}"),
        Style::default().fg(DIM),
    ));

    let block = Block::default()
        .borders(Borders::TOP)
        .border_style(Style::default().fg(PURPLE_DIM));

    let para = Paragraph::new(line).block(block);
    f.render_widget(para, area);
}

fn render_content(f: &mut Frame, area: Rect, app: &mut App) {
    match app.step {
        Step::Welcome => render_welcome(f, area),
        Step::ModelSelect => render_model_select(f, area, app),
        Step::LanguageInput => render_text_input(
            f,
            area,
            "Response language",
            "Which language should Ombra respond in?",
            "ISO 639-1 code — e.g. en, da, de, fr",
            &app.input.clone(),
        ),
        Step::ConnectionModeSelect => render_connection_mode_select(f, area, app),
        Step::RemoteTokenInput => render_text_input(
            f,
            area,
            "DuckDNS token",
            "Set up DuckDNS remote access",
            "Paste your DuckDNS token from duckdns.org",
            &app.input.clone(),
        ),
        Step::RemoteSubdomainInput => render_text_input(
            f,
            area,
            "DuckDNS subdomain",
            "Set up DuckDNS remote access",
            "Your subdomain — e.g. my-ombra (without .duckdns.org)",
            &app.input.clone(),
        ),
        Step::TailscaleCheck => render_tailscale_check(f, area, app),
        Step::Starting => render_starting(f, area),
        Step::OnboardingName => render_onboarding(
            f, area, app, "What is your name?",
        ),
        Step::OnboardingOccupation => render_onboarding(
            f, area, app, "What do you do for work?",
        ),
        Step::OnboardingLocation => render_onboarding(
            f, area, app, "Where are you based?",
        ),
        Step::OnboardingPeople => render_onboarding(
            f, area, app, "Who are the most important people in your life?",
        ),
        Step::OnboardingProjects => render_onboarding(
            f, area, app, "What are you currently working on?",
        ),
        Step::OnboardingAdditional => render_onboarding(
            f, area, app, "Anything else you'd like Ombra to know about you?",
        ),
        Step::Waiting => render_waiting(f, area, app),
        Step::Done => render_done(f, area, app),
    }
}

fn centered_rect(width: u16, height: u16, area: Rect) -> Rect {
    let h = Layout::vertical([
        Constraint::Fill(1),
        Constraint::Length(height),
        Constraint::Fill(1),
    ])
    .split(area);

    let v = Layout::horizontal([
        Constraint::Fill(1),
        Constraint::Length(width),
        Constraint::Fill(1),
    ])
    .split(h[1]);

    v[1]
}

fn render_welcome(f: &mut Frame, area: Rect) {
    let box_width = 52u16.min(area.width.saturating_sub(4));
    let box_height = 14u16.min(area.height.saturating_sub(2));
    let inner = centered_rect(box_width, box_height, area);

    let block = Block::bordered()
        .border_type(BorderType::Rounded)
        .border_style(Style::default().fg(PURPLE_DIM));

    let lines = vec![
        Line::from(""),
        Line::from(Span::styled(
            "O M B R A",
            Style::default()
                .fg(PURPLE)
                .add_modifier(Modifier::BOLD),
        ))
        .alignment(Alignment::Center),
        Line::from(""),
        Line::from(Span::styled(
            "Self-Hosted Personal Memory",
            Style::default().fg(WHITE),
        ))
        .alignment(Alignment::Center),
        Line::from(""),
        Line::from(Span::styled(
            "Everything runs on your own hardware.",
            Style::default().fg(DIM),
        ))
        .alignment(Alignment::Center),
        Line::from(Span::styled(
            "Your data never leaves your device.",
            Style::default().fg(DIM),
        ))
        .alignment(Alignment::Center),
        Line::from(""),
        Line::from(""),
        Line::from(Span::styled(
            "Press Enter to begin →",
            Style::default().fg(PURPLE),
        ))
        .alignment(Alignment::Center),
        Line::from(""),
    ];

    let para = Paragraph::new(lines)
        .block(block)
        .alignment(Alignment::Left);

    f.render_widget(para, inner);
}

fn render_model_select(f: &mut Frame, area: Rect, app: &mut App) {
    let layout = Layout::vertical([
        Constraint::Length(4),
        Constraint::Min(0),
    ])
    .split(area);

    let detected_name = app.detected_profile.display_name();
    let header = Paragraph::new(vec![
        Line::from(""),
        Line::from(vec![
            Span::styled("  Choose your AI model", Style::default().fg(WHITE).add_modifier(Modifier::BOLD)),
        ]),
        Line::from(vec![
            Span::raw("  "),
            Span::styled(
                format!("Detected hardware: {}", std::env::consts::ARCH),
                Style::default().fg(DIM),
            ),
            Span::styled(
                format!("  ·  Recommended: {}", detected_name),
                Style::default().fg(DIM),
            ),
        ]),
    ]);
    f.render_widget(header, layout[0]);

    let detected = app.detected_profile.clone();
    let items: Vec<ListItem> = PROFILES
        .iter()
        .map(|profile| {
            let is_recommended = std::mem::discriminant(profile) == std::mem::discriminant(&detected);
            let (size, desc) = profile_details(profile);
            let rec = if is_recommended {
                Span::styled("  ← recommended", Style::default().fg(GREEN))
            } else {
                Span::raw("")
            };
            ListItem::new(Line::from(vec![
                Span::styled(
                    format!("  {:<13}", profile_short_name(profile)),
                    Style::default().fg(WHITE).add_modifier(Modifier::BOLD),
                ),
                Span::styled(format!("{:<10}", size), Style::default().fg(DIM)),
                Span::styled(desc, Style::default().fg(DIM)),
                rec,
            ]))
        })
        .collect();

    let list = List::new(items)
        .highlight_style(
            Style::default()
                .bg(PURPLE_DIM)
                .fg(WHITE)
                .add_modifier(Modifier::BOLD),
        )
        .highlight_symbol("▶ ");

    let block = Block::default()
        .borders(Borders::LEFT)
        .border_style(Style::default().fg(PURPLE_DIM))
        .padding(Padding::horizontal(1));

    let list = list.block(block);
    f.render_stateful_widget(list, layout[1], &mut app.list_state);
}

fn profile_short_name(profile: &HardwareProfile) -> &'static str {
    match profile {
        HardwareProfile::Nano => "Nano",
        HardwareProfile::Edge => "Edge",
        HardwareProfile::Efficiency => "Efficiency",
        HardwareProfile::Performance => "Performance",
    }
}

fn profile_details(profile: &HardwareProfile) -> (&'static str, &'static str) {
    match profile {
        HardwareProfile::Nano => ("~1.0 GB", "Qwen2.5-1.5B Q4_K_M  ·  fits in 2 GB RAM"),
        HardwareProfile::Edge => ("~1.6 GB", "Gemma-2-2B Q4_K_M    ·  ARM-optimised, 4+ GB RAM"),
        HardwareProfile::Efficiency => ("~2.8 GB", "Gemma-2-2B Q8_0      ·  balanced"),
        HardwareProfile::Performance => ("~9.8 GB", "Gemma-2-9B Q8_0      ·  best quality, needs 32+ GB RAM"),
    }
}

fn render_text_input(
    f: &mut Frame,
    area: Rect,
    field_label: &str,
    title: &str,
    hint: &str,
    value: &str,
) {
    let layout = Layout::vertical([
        Constraint::Length(3),
        Constraint::Length(2),
        Constraint::Length(3),
        Constraint::Length(1),
        Constraint::Min(0),
    ])
    .split(area);

    f.render_widget(
        Paragraph::new(vec![
            Line::from(""),
            Line::from(Span::styled(
                format!("  {title}"),
                Style::default().fg(WHITE).add_modifier(Modifier::BOLD),
            )),
        ]),
        layout[0],
    );

    f.render_widget(
        Paragraph::new(Line::from(vec![
            Span::raw("  "),
            Span::styled(hint, Style::default().fg(DIM)),
        ])),
        layout[1],
    );

    let display = format!("{value}_");
    let input_block = Block::bordered()
        .border_type(BorderType::Rounded)
        .border_style(Style::default().fg(PURPLE))
        .title(Span::styled(
            format!(" {field_label} "),
            Style::default().fg(PURPLE),
        ));

    let input_width = 40u16.min(area.width.saturating_sub(6));
    let input_area = Rect {
        x: area.x + 2,
        y: layout[2].y,
        width: input_width,
        height: 3,
    };

    f.render_widget(
        Paragraph::new(Span::styled(display, Style::default().fg(WHITE))).block(input_block),
        input_area,
    );
}

fn render_connection_mode_select(f: &mut Frame, area: Rect, app: &mut App) {
    let layout = Layout::vertical([
        Constraint::Length(4),
        Constraint::Min(0),
    ])
    .split(area);

    f.render_widget(
        Paragraph::new(vec![
            Line::from(""),
            Line::from(Span::styled(
                "  Connection mode",
                Style::default().fg(WHITE).add_modifier(Modifier::BOLD),
            )),
            Line::from(vec![
                Span::raw("  "),
                Span::styled("How will devices connect to your Ombra server?", Style::default().fg(DIM)),
            ]),
        ]),
        layout[0],
    );

    let selected = app.list_state.selected().unwrap_or(0);
    let items: Vec<ListItem> = CONNECTION_MODES
        .iter()
        .enumerate()
        .map(|(i, entry)| {
            let is_available = entry.mode.is_some();
            let is_selected = i == selected;

            let label_style = if is_available {
                if is_selected {
                    Style::default().fg(WHITE).add_modifier(Modifier::BOLD)
                } else {
                    Style::default().fg(WHITE)
                }
            } else {
                Style::default().fg(DIM)
            };

            let desc_style = if is_available {
                Style::default().fg(DIM)
            } else {
                Style::default().fg(Color::Rgb(50, 50, 50))
            };

            ListItem::new(Line::from(vec![
                Span::styled(format!("  {:<20}", entry.label), label_style),
                Span::styled(entry.description, desc_style),
            ]))
        })
        .collect();

    let list = List::new(items)
        .highlight_style(Style::default().bg(PURPLE_DIM).fg(WHITE))
        .highlight_symbol("▶ ");

    let block = Block::default()
        .borders(Borders::LEFT)
        .border_style(Style::default().fg(PURPLE_DIM))
        .padding(Padding::horizontal(1));

    f.render_stateful_widget(list.block(block), layout[1], &mut app.list_state);
}

fn render_tailscale_check(f: &mut Frame, area: Rect, app: &App) {
    let layout = Layout::vertical([
        Constraint::Length(4),
        Constraint::Min(0),
    ])
    .split(area);

    f.render_widget(
        Paragraph::new(vec![
            Line::from(""),
            Line::from(Span::styled(
                "  Tailscale setup",
                Style::default().fg(WHITE).add_modifier(Modifier::BOLD),
            )),
            Line::from(vec![
                Span::raw("  "),
                Span::styled("Checking Tailscale status...", Style::default().fg(DIM)),
            ]),
        ]),
        layout[0],
    );

    let lines = match &app.tailscale_status {
        None => vec![
            Line::from(""),
            Line::from(Span::styled("  Detecting...", Style::default().fg(DIM))),
        ],
        Some(TailscaleStatus::NotInstalled) => vec![
            Line::from(""),
            Line::from(Span::styled(
                "  Tailscale is not installed.",
                Style::default().fg(YELLOW).add_modifier(Modifier::BOLD),
            )),
            Line::from(""),
            Line::from(Span::styled("  Install it from:", Style::default().fg(DIM))),
            Line::from(Span::styled(
                "  https://tailscale.com/download",
                Style::default().fg(BLUE),
            )),
            Line::from(""),
            Line::from(Span::styled("  After installing and logging in:", Style::default().fg(DIM))),
            Line::from(Span::styled("    sudo tailscale up", Style::default().fg(WHITE))),
            Line::from(""),
            Line::from(Span::styled(
                "  Press Enter to continue anyway — you can set up Tailscale later.",
                Style::default().fg(DIM),
            )),
        ],
        Some(TailscaleStatus::NotLoggedIn) => vec![
            Line::from(""),
            Line::from(Span::styled(
                "  Tailscale is installed but not connected.",
                Style::default().fg(YELLOW).add_modifier(Modifier::BOLD),
            )),
            Line::from(""),
            Line::from(Span::styled("  Log in with:", Style::default().fg(DIM))),
            Line::from(Span::styled("    sudo tailscale up", Style::default().fg(WHITE))),
            Line::from(""),
            Line::from(Span::styled(
                "  Press Enter to continue anyway — you can connect Tailscale later.",
                Style::default().fg(DIM),
            )),
        ],
        Some(TailscaleStatus::Connected { ip }) => vec![
            Line::from(""),
            Line::from(vec![
                Span::styled("  ✓  Tailscale connected  ", Style::default().fg(GREEN).add_modifier(Modifier::BOLD)),
                Span::styled(ip, Style::default().fg(GREEN)),
            ]),
            Line::from(""),
            Line::from(Span::styled(
                "  Your Ombra server will be reachable at this IP via Tailscale.",
                Style::default().fg(DIM),
            )),
            Line::from(Span::styled(
                "  The admin panel is accessible from any Tailscale device.",
                Style::default().fg(DIM),
            )),
            Line::from(""),
            Line::from(Span::styled(
                "  Press Enter to continue →",
                Style::default().fg(PURPLE),
            )),
        ],
    };

    f.render_widget(Paragraph::new(lines), layout[1]);
}

fn render_starting(f: &mut Frame, area: Rect) {
    let inner = centered_rect(40, 5, area);
    let lines = vec![
        Line::from(""),
        Line::from(Span::styled(
            "Generating certificates...",
            Style::default().fg(DIM),
        ))
        .alignment(Alignment::Center),
    ];
    f.render_widget(Paragraph::new(lines), inner);
}

fn render_onboarding(f: &mut Frame, area: Rect, app: &App, question: &str) {
    let (current, total) = app.onboarding_progress();

    let layout = Layout::vertical([
        Constraint::Length(4),
        Constraint::Length(2),
        Constraint::Length(3),
        Constraint::Min(0),
        Constraint::Length(5),
    ])
    .split(area);

    // Header
    f.render_widget(
        Paragraph::new(vec![
            Line::from(""),
            Line::from(Span::styled(
                "  Tell Ombra about yourself",
                Style::default().fg(WHITE).add_modifier(Modifier::BOLD),
            )),
            Line::from(vec![
                Span::raw("  "),
                Span::styled(
                    "While your server finishes setting up in the background.",
                    Style::default().fg(DIM),
                ),
            ]),
        ]),
        layout[0],
    );

    // Question
    f.render_widget(
        Paragraph::new(Line::from(vec![
            Span::raw("  "),
            Span::styled(
                format!("{current}/{total}  "),
                Style::default().fg(PURPLE_DIM),
            ),
            Span::styled(question, Style::default().fg(WHITE)),
        ])),
        layout[1],
    );

    // Input field
    let display = format!("{}_", app.input);
    let input_width = 60u16.min(area.width.saturating_sub(6));
    let input_area = Rect {
        x: area.x + 2,
        y: layout[2].y,
        width: input_width,
        height: 3,
    };
    f.render_widget(
        Paragraph::new(Span::styled(display, Style::default().fg(WHITE))).block(
            Block::bordered()
                .border_type(BorderType::Rounded)
                .border_style(Style::default().fg(PURPLE)),
        ),
        input_area,
    );

    // Background progress (small, bottom)
    render_small_progress(f, layout[4], app);
}

fn render_small_progress(f: &mut Frame, area: Rect, app: &App) {
    let lines = vec![
        progress_line("  Qdrant  ", &app.progress.qdrant, None),
        progress_line(
            "  Model   ",
            &app.progress.model.status,
            Some(app.progress.model.fraction()),
        ),
        progress_line("  Build   ", &app.progress.build, None),
    ];
    f.render_widget(
        Paragraph::new(lines).block(
            Block::default()
                .borders(Borders::TOP)
                .border_style(Style::default().fg(PURPLE_DIM)),
        ),
        area,
    );
}

fn progress_line<'a>(label: &'a str, status: &TaskStatus, fraction: Option<f64>) -> Line<'a> {
    let (indicator, color) = match status {
        TaskStatus::Pending => ("○  waiting", DIM),
        TaskStatus::Running => ("●  running", YELLOW),
        TaskStatus::Done => ("✓  ready", GREEN),
        TaskStatus::Failed(_) => ("✗  failed", RED),
    };

    let mut spans = vec![
        Span::styled(label, Style::default().fg(DIM)),
        Span::styled(indicator, Style::default().fg(color)),
    ];

    if let (Some(f), TaskStatus::Running) = (fraction, status) {
        let pct = (f * 100.0) as u64;
        spans.push(Span::styled(
            format!("  {pct}%"),
            Style::default().fg(DIM),
        ));
    }

    Line::from(spans)
}

fn render_waiting(f: &mut Frame, area: Rect, app: &App) {
    let layout = Layout::vertical([
        Constraint::Length(3),
        Constraint::Length(1),
        Constraint::Length(2),
        Constraint::Length(2),
        Constraint::Length(2),
        Constraint::Min(0),
    ])
    .split(area);

    f.render_widget(
        Paragraph::new(vec![
            Line::from(""),
            Line::from(Span::styled(
                "  Almost there...",
                Style::default().fg(WHITE).add_modifier(Modifier::BOLD),
            )),
        ]),
        layout[0],
    );

    render_progress_bar(f, layout[2], "  Qdrant    ", &app.progress.qdrant, None);
    render_progress_bar(
        f,
        layout[3],
        "  AI model  ",
        &app.progress.model.status,
        Some(app.progress.model.fraction()),
    );
    render_progress_bar(f, layout[4], "  Build     ", &app.progress.build, None);
}

fn render_progress_bar(
    f: &mut Frame,
    area: Rect,
    label: &str,
    status: &TaskStatus,
    fraction: Option<f64>,
) {
    let ratio = match status {
        TaskStatus::Done => 1.0,
        TaskStatus::Running => fraction.unwrap_or(0.3),
        _ => 0.0,
    };

    let (label_style, gauge_style) = match status {
        TaskStatus::Done => (
            Style::default().fg(GREEN),
            Style::default().fg(GREEN).bg(Color::Black),
        ),
        TaskStatus::Failed(_) => (
            Style::default().fg(RED),
            Style::default().fg(RED).bg(Color::Black),
        ),
        _ => (
            Style::default().fg(DIM),
            Style::default().fg(PURPLE).bg(Color::Black),
        ),
    };

    let suffix = match status {
        TaskStatus::Done => "  ready".to_string(),
        TaskStatus::Failed(e) => format!("  failed: {}", e.chars().take(30).collect::<String>()),
        TaskStatus::Running => {
            if let Some(f) = fraction {
                format!("  {}%", (f * 100.0) as u64)
            } else {
                "  running...".to_string()
            }
        }
        TaskStatus::Pending => "  waiting".to_string(),
    };

    let bar_width = area.width.saturating_sub(label.len() as u16 + 20);
    let bar_area = Rect {
        x: area.x + label.len() as u16,
        y: area.y,
        width: bar_width.max(10),
        height: 1,
    };

    f.render_widget(
        Paragraph::new(Span::styled(label, label_style)),
        Rect { x: area.x, y: area.y, width: label.len() as u16, height: 1 },
    );

    f.render_widget(
        Gauge::default()
            .gauge_style(gauge_style)
            .ratio(ratio)
            .label(""),
        bar_area,
    );

    let suffix_area = Rect {
        x: bar_area.x + bar_area.width,
        y: area.y,
        width: area.width.saturating_sub(bar_area.x + bar_area.width - area.x),
        height: 1,
    };

    f.render_widget(
        Paragraph::new(Span::styled(suffix, Style::default().fg(DIM))),
        suffix_area,
    );
}

fn render_done(f: &mut Frame, area: Rect, app: &App) {
    let layout = Layout::vertical([
        Constraint::Length(3),
        Constraint::Min(0),
    ])
    .split(area);

    f.render_widget(
        Paragraph::new(vec![
            Line::from(""),
            Line::from(Span::styled(
                "  ✓  Ombra is ready",
                Style::default().fg(GREEN).add_modifier(Modifier::BOLD),
            )),
        ]),
        layout[0],
    );

    let is_wsl = std::fs::read_to_string("/proc/version")
        .unwrap_or_default()
        .to_lowercase()
        .contains("microsoft");
    let is_linux = std::env::consts::OS == "linux";

    let start_cmd = if is_linux && !is_wsl {
        "sudo systemctl start ombra"
    } else {
        "./target/release/ombra-server"
    };

    let log_cmd = if is_linux && !is_wsl {
        "journalctl -u ombra -f"
    } else {
        "tail -f ombra.log"
    };

    let remote_line = match &app.connection_mode {
        RemoteAccessMode::DuckDns if !app.ddns_subdomain.is_empty() => {
            format!("  Remote:   https://{}.duckdns.org:8080", app.ddns_subdomain)
        }
        RemoteAccessMode::Tailscale => match &app.tailscale_status {
            Some(TailscaleStatus::Connected { ip }) => {
                format!("  Tailscale: https://{}:8080", ip)
            }
            _ => "  Tailscale: not connected  (run: sudo tailscale up)".to_string(),
        },
        _ => "  Remote:   not configured  (run install again to enable)".to_string(),
    };

    let lines = vec![
        Line::from(vec![
            Span::styled("  Local:    ", Style::default().fg(DIM)),
            Span::styled("https://ombra.local:8080", Style::default().fg(WHITE)),
        ]),
        Line::from(vec![
            Span::styled("  ", Style::default()),
            Span::styled(remote_line.trim_start(), Style::default().fg(DIM)),
        ]),
        Line::from(""),
        Line::from(vec![
            Span::styled("  Start:    ", Style::default().fg(DIM)),
            Span::styled(start_cmd, Style::default().fg(WHITE)),
        ]),
        Line::from(vec![
            Span::styled("  Logs:     ", Style::default().fg(DIM)),
            Span::styled(log_cmd, Style::default().fg(WHITE)),
        ]),
        Line::from(""),
        Line::from(Span::styled(
            "  Connect the app:",
            Style::default().fg(WHITE).add_modifier(Modifier::BOLD),
        )),
        Line::from(vec![
            Span::styled("  Run  ", Style::default().fg(DIM)),
            Span::styled("bash show-qr.sh", Style::default().fg(PURPLE)),
            Span::styled("  to display the QR code for the Ombra app.", Style::default().fg(DIM)),
        ]),
        Line::from(""),
        Line::from(Span::styled(
            "  Certs:  certs/  —  copy client.crt + client.key + ca.crt to your app",
            Style::default().fg(DIM),
        )),
    ];

    f.render_widget(
        Paragraph::new(lines).wrap(Wrap { trim: false }),
        layout[1],
    );
}
