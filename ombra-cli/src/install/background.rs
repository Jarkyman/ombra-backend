use std::io::Write as _;
use std::os::unix::fs::OpenOptionsExt;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::mpsc::Sender;
use std::thread;
use std::time::Duration;

use ombra_common::config::{AppConfig, DdnsConfig, DdnsProvider, RemoteAccessMode};
use ombra_common::hardware::HardwareProfile;

use crate::install::state::{BackgroundEvent, OnboardingAnswers, TailscaleStatus};

fn model_expected_bytes(profile: &HardwareProfile) -> u64 {
    match profile {
        HardwareProfile::Performance => 10_483_343_360,
        HardwareProfile::Efficiency => 2_998_927_360,
        HardwareProfile::Edge => 1_718_009_856,
        HardwareProfile::Nano => 1_073_741_824,
    }
}

pub fn start_all(tx: Sender<BackgroundEvent>, install_dir: PathBuf, profile: HardwareProfile) {
    let tx_qdrant = tx.clone();
    let dir_qdrant = install_dir.clone();
    thread::spawn(move || run_qdrant(tx_qdrant, dir_qdrant));

    let tx_model = tx.clone();
    let dir_model = install_dir.clone();
    let profile_model = profile.clone();
    thread::spawn(move || run_model_download(tx_model, dir_model, profile_model));

    let tx_build = tx;
    let dir_build = install_dir;
    thread::spawn(move || run_server_build(tx_build, dir_build));
}

fn run_qdrant(tx: Sender<BackgroundEvent>, install_dir: PathBuf) {
    let out = Command::new("docker")
        .args(["compose", "-f", "docker-compose.yml", "up", "-d"])
        .current_dir(&install_dir)
        .output();

    match out {
        Ok(o) if o.status.success() => {}
        Ok(o) => {
            let msg = String::from_utf8_lossy(&o.stderr).to_string();
            tx.send(BackgroundEvent::QdrantFailed(msg)).ok();
            return;
        }
        Err(e) => {
            tx.send(BackgroundEvent::QdrantFailed(e.to_string())).ok();
            return;
        }
    }

    for _ in 0..60 {
        if qdrant_healthy() {
            tx.send(BackgroundEvent::QdrantReady).ok();
            return;
        }
        thread::sleep(Duration::from_secs(1));
    }

    tx.send(BackgroundEvent::QdrantFailed("Qdrant health check timed out".into())).ok();
}

fn qdrant_healthy() -> bool {
    Command::new("curl")
        .args(["-sf", "http://localhost:6333/healthz"])
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

fn run_model_download(tx: Sender<BackgroundEvent>, install_dir: PathBuf, profile: HardwareProfile) {
    let models_dir = install_dir.join("models");
    std::fs::create_dir_all(&models_dir).ok();

    let filename = profile.model_filename();
    let model_path = models_dir.join(filename);
    let expected = model_expected_bytes(&profile);

    if model_path.exists() {
        let size = std::fs::metadata(&model_path).map(|m| m.len()).unwrap_or(0);
        tx.send(BackgroundEvent::ModelProgress { downloaded: size, total: expected }).ok();
        tx.send(BackgroundEvent::ModelReady).ok();
        return;
    }

    let url = format!(
        "https://huggingface.co/{}/resolve/main/{}",
        profile.huggingface_repo(),
        filename
    );

    let mut child = match Command::new("curl")
        .args(["-L", "--silent", "-o", model_path.to_str().unwrap_or(""), &url])
        .spawn()
    {
        Ok(c) => c,
        Err(e) => {
            tx.send(BackgroundEvent::ModelFailed(e.to_string())).ok();
            return;
        }
    };

    loop {
        thread::sleep(Duration::from_secs(2));

        let downloaded = std::fs::metadata(&model_path)
            .map(|m| m.len())
            .unwrap_or(0);
        tx.send(BackgroundEvent::ModelProgress { downloaded, total: expected }).ok();

        match child.try_wait() {
            Ok(Some(status)) => {
                if status.success() {
                    tx.send(BackgroundEvent::ModelReady).ok();
                } else {
                    std::fs::remove_file(&model_path).ok();
                    tx.send(BackgroundEvent::ModelFailed("Download failed. Check your connection.".into())).ok();
                }
                return;
            }
            Ok(None) => continue,
            Err(e) => {
                tx.send(BackgroundEvent::ModelFailed(e.to_string())).ok();
                return;
            }
        }
    }
}

fn run_server_build(tx: Sender<BackgroundEvent>, install_dir: PathBuf) {
    let result = Command::new("cargo")
        .args(["build", "--release", "-p", "ombra-server"])
        .current_dir(&install_dir)
        .output();

    match result {
        Ok(o) if o.status.success() => {
            tx.send(BackgroundEvent::BuildReady).ok();
        }
        Ok(o) => {
            let stderr = String::from_utf8_lossy(&o.stderr).to_string();
            let short = stderr.lines().rev().take(3).collect::<Vec<_>>().join(" | ");
            tx.send(BackgroundEvent::BuildFailed(short)).ok();
        }
        Err(e) => {
            tx.send(BackgroundEvent::BuildFailed(e.to_string())).ok();
        }
    }
}

pub fn detect_tailscale_status() -> TailscaleStatus {
    let installed = Command::new("tailscale")
        .arg("--version")
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false);

    if !installed {
        return TailscaleStatus::NotInstalled;
    }

    let out = Command::new("tailscale")
        .args(["ip", "-4"])
        .output();

    match out {
        Ok(o) if o.status.success() => {
            let ip = String::from_utf8_lossy(&o.stdout).trim().to_string();
            if ip.is_empty() {
                TailscaleStatus::NotLoggedIn
            } else {
                TailscaleStatus::Connected { ip }
            }
        }
        _ => TailscaleStatus::NotLoggedIn,
    }
}

pub fn write_config(
    install_dir: &Path,
    profile: HardwareProfile,
    language: String,
    connection_mode: RemoteAccessMode,
    ddns_token: &str,
    ddns_subdomain: &str,
) -> Result<(), String> {
    let config_path = install_dir.join("ombra.toml");
    if config_path.exists() {
        return Ok(());
    }

    let ddns = if matches!(connection_mode, RemoteAccessMode::DuckDns)
        && !ddns_token.is_empty()
        && !ddns_subdomain.is_empty()
    {
        Some(DdnsConfig {
            provider: DdnsProvider::DuckDns,
            token: ddns_token.to_string(),
            subdomain: ddns_subdomain.to_string(),
        })
    } else {
        None
    };

    let config = AppConfig {
        hardware_profile: profile,
        response_language: language,
        remote_access_mode: connection_mode,
        ddns,
        ..AppConfig::default()
    };

    let content = toml::to_string_pretty(&config)
        .map_err(|e| format!("serialize config: {e}"))?;

    let mut file = std::fs::OpenOptions::new()
        .write(true)
        .create(true)
        .truncate(true)
        .mode(0o600)
        .open(&config_path)
        .map_err(|e| format!("create config: {e}"))?;

    file.write_all(content.as_bytes())
        .map_err(|e| format!("write config: {e}"))?;

    Ok(())
}

pub fn generate_certificates(install_dir: &Path) -> Result<(), String> {
    let certs_dir = install_dir.join("certs");
    if certs_dir.join("server.crt").exists() && certs_dir.join("client.crt").exists() {
        return Ok(());
    }

    let server_ip = detect_server_ip();

    let mut cmd = Command::new("bash");
    cmd.arg("scripts/generate_dev_certs.sh").current_dir(install_dir);
    if let Some(ip) = server_ip {
        cmd.args(["--server-ip", &ip]);
    }

    let out = cmd.output().map_err(|e| format!("cert generation: {e}"))?;
    if !out.status.success() {
        let msg = String::from_utf8_lossy(&out.stderr).to_string();
        return Err(format!("cert generation failed: {msg}"));
    }

    Ok(())
}

pub fn setup_mdns(install_dir: &Path) {
    let is_linux = std::env::consts::OS == "linux";
    if !is_linux {
        return;
    }

    Command::new("bash")
        .arg("scripts/setup_mdns.sh")
        .current_dir(install_dir)
        .output()
        .ok();
}

pub fn write_user_profile(
    install_dir: &Path,
    onboarding: &OnboardingAnswers,
) -> Result<(), String> {
    let profile_path = install_dir.join("user_profile.toml");

    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    let content = format!(
        "# Ombra user profile\n\n[profile]\nname = {}\noccupation = {}\nlocation = {}\nimportant_people = {}\ncurrent_projects = {}\nadditional = {}\ncreated_at = {}\n",
        toml_quote(&onboarding.name),
        toml_quote(&onboarding.occupation),
        toml_quote(&onboarding.location),
        toml_quote(&onboarding.important_people),
        toml_quote(&onboarding.current_projects),
        toml_quote(&onboarding.additional),
        timestamp,
    );

    let mut file = std::fs::OpenOptions::new()
        .write(true)
        .create(true)
        .truncate(true)
        .mode(0o600)
        .open(&profile_path)
        .map_err(|e| format!("create profile: {e}"))?;

    file.write_all(content.as_bytes())
        .map_err(|e| format!("write profile: {e}"))?;

    Ok(())
}

pub fn install_and_start_service(install_dir: &Path) -> Result<(), String> {
    if std::env::consts::OS != "linux" {
        return Ok(());
    }

    if Command::new("systemctl").arg("--version").output().is_err() {
        return Ok(());
    }

    let binary = install_dir.join("target/release/ombra-server");
    let user = std::env::var("USER").unwrap_or_else(|_| "root".to_string());

    let service = format!(
        "[Unit]\nDescription=Ombra Personal Memory Server\nAfter=network-online.target docker.service\nWants=network-online.target\nRequires=docker.service\n\n[Service]\nType=simple\nUser={user}\nWorkingDirectory={dir}\nExecStart={bin}\nRestart=always\nRestartSec=5\n\n[Install]\nWantedBy=multi-user.target\n",
        user = user,
        dir = install_dir.display(),
        bin = binary.display(),
    );

    std::fs::write("/etc/systemd/system/ombra.service", &service)
        .map_err(|e| format!("write service file: {e}"))?;

    Command::new("systemctl").arg("daemon-reload").output().ok();
    Command::new("systemctl").args(["enable", "ombra"]).output().ok();
    Command::new("systemctl")
        .args(["start", "ombra"])
        .output()
        .map_err(|e| format!("start service: {e}"))?;

    Ok(())
}

fn detect_server_ip() -> Option<String> {
    let out = Command::new("sh")
        .args(["-c", "ip -4 addr show scope global | grep -oP '(?<=inet\\s)\\d+(\\.[0-9]+){3}' | head -1"])
        .output()
        .ok()?;
    let ip = String::from_utf8_lossy(&out.stdout).trim().to_string();
    if ip.is_empty() { None } else { Some(ip) }
}

fn toml_quote(s: &str) -> String {
    format!("\"{}\"", s.replace('\\', "\\\\").replace('"', "\\\""))
}
