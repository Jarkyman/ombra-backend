use std::net::TcpStream;
use std::path::Path;
use std::process::Command;
use std::time::Duration;

use clap::Subcommand;
use ombra_common::config::AppConfig;

const CONFIG_PATH: &str = "ombra.toml";

#[derive(Subcommand)]
pub enum OmbraCommand {
    Dashboard,
    /// Print server health, model, database, and service state
    Status,
    /// Pull latest code and rebuild (requires git + cargo in PATH)
    Upgrade,
    Install,
}

// ── status ────────────────────────────────────────────────────────────────────

pub async fn print_status() {
    let config = AppConfig::load(Path::new(CONFIG_PATH)).ok();

    println!();
    println!("  \x1b[1;97mOmbra Status\x1b[0m");
    println!("  {}", "─".repeat(44));

    print_server_row(&config);
    print_service_row();
    print_model_row(&config);
    print_database_row(&config);

    println!();
}

fn print_server_row(config: &Option<AppConfig>) {
    let Some(cfg) = config else {
        row("Server", "\x1b[33munknown\x1b[0m", "ombra.toml not found");
        return;
    };

    let addr = format!("127.0.0.1:{}", cfg.server_port);
    let reachable = TcpStream::connect_timeout(
        &addr.parse().unwrap(),
        Duration::from_secs(2),
    )
    .is_ok();

    if reachable {
        row("Server", "\x1b[32mreachable\x1b[0m", &format!("localhost:{}", cfg.server_port));
    } else {
        row("Server", "\x1b[31munreachable\x1b[0m", &format!("localhost:{}", cfg.server_port));
    }
}

fn print_service_row() {
    let output = Command::new("systemctl")
        .args(["is-active", "--quiet", "ombra"])
        .output();

    match output {
        Ok(o) if o.status.success() => row("Service", "\x1b[32mactive\x1b[0m", "systemd: ombra"),
        Ok(_) => row("Service", "\x1b[31minactive\x1b[0m", "systemd: ombra"),
        Err(_) => row("Service", "\x1b[33munknown\x1b[0m", "systemd not available"),
    }
}

fn print_model_row(config: &Option<AppConfig>) {
    match config {
        Some(cfg) => {
            let model = cfg.hardware_profile.model_filename();
            row("Model", "\x1b[97m", &format!("{}\x1b[0m", model));
        }
        None => row("Model", "\x1b[33munknown\x1b[0m", ""),
    }
}

fn print_database_row(config: &Option<AppConfig>) {
    let db_path = config
        .as_ref()
        .map(|c| c.database_path.clone())
        .unwrap_or_else(|| std::path::PathBuf::from("ombra.db"));

    match std::fs::metadata(&db_path) {
        Ok(meta) => {
            let size = format_bytes(meta.len());
            row("Database", &format!("\x1b[97m{}\x1b[0m", size), &db_path.display().to_string());
        }
        Err(_) => row(
            "Database",
            "\x1b[33mnot found\x1b[0m",
            &db_path.display().to_string(),
        ),
    }
}

fn row(label: &str, status: &str, detail: &str) {
    println!(
        "  \x1b[2m{:<12}\x1b[0m  {}  \x1b[2m{}\x1b[0m",
        label, status, detail
    );
}

fn format_bytes(bytes: u64) -> String {
    if bytes >= 1_000_000 {
        format!("{:.1} MB", bytes as f64 / 1_000_000.0)
    } else if bytes >= 1_000 {
        format!("{:.1} KB", bytes as f64 / 1_000.0)
    } else {
        format!("{} B", bytes)
    }
}

// ── upgrade ───────────────────────────────────────────────────────────────────

pub fn run_upgrade() {
    println!();
    println!("  \x1b[1;97mOmbra Upgrade\x1b[0m");
    println!("  {}", "─".repeat(44));
    println!();

    if !run_step("git pull", &["git", "pull"]) {
        return;
    }

    if !run_step("cargo build --release", &["cargo", "build", "--release"]) {
        return;
    }

    let restart = Command::new("sudo")
        .args(["systemctl", "restart", "ombra"])
        .status();

    match restart {
        Ok(s) if s.success() => {
            println!("  \x1b[32m✓\x1b[0m  Service restarted");
        }
        _ => {
            println!("  \x1b[33m!\x1b[0m  Could not restart service — run: sudo systemctl restart ombra");
        }
    }

    println!();
}

fn run_step(label: &str, args: &[&str]) -> bool {
    print!("  \x1b[2m{:<30}\x1b[0m  ", label);

    let status = Command::new(args[0])
        .args(&args[1..])
        .status();

    match status {
        Ok(s) if s.success() => {
            println!("\x1b[32m✓\x1b[0m");
            true
        }
        Ok(s) => {
            println!("\x1b[31m✗  exit {}\x1b[0m", s.code().unwrap_or(-1));
            false
        }
        Err(e) => {
            println!("\x1b[31m✗  {e}\x1b[0m");
            false
        }
    }
}
