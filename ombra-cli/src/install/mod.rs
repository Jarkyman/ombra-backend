mod background;
mod state;
mod ui;

use std::io;
use std::sync::mpsc;
use std::time::Duration;

use crossterm::{
    event::{self, DisableMouseCapture, EnableMouseCapture, Event},
    execute,
    terminal::{EnterAlternateScreen, LeaveAlternateScreen, disable_raw_mode, enable_raw_mode},
};
use ombra_common::hardware::HardwareProfile;
use ratatui::{Terminal, backend::CrosstermBackend};

use state::{App, BackgroundEvent, Step};

pub fn run() {
    let install_dir = std::env::current_dir().unwrap_or_else(|_| std::path::PathBuf::from("."));
    let detected = HardwareProfile::detect();

    let (tx, rx) = mpsc::channel::<BackgroundEvent>();
    let mut app = App::new(detected, rx, install_dir);

    let result = run_tui(&mut app, tx);

    if let Err(e) = result {
        eprintln!("Setup error: {e}");
        std::process::exit(1);
    }
}

fn run_tui(app: &mut App, tx: mpsc::Sender<BackgroundEvent>) -> io::Result<()> {
    enable_raw_mode()?;
    let mut stdout = io::stdout();
    execute!(stdout, EnterAlternateScreen, EnableMouseCapture)?;
    let backend = CrosstermBackend::new(stdout);
    let mut terminal = Terminal::new(backend)?;

    let result = run_loop(&mut terminal, app, tx);

    disable_raw_mode()?;
    execute!(
        terminal.backend_mut(),
        LeaveAlternateScreen,
        DisableMouseCapture
    )?;
    terminal.show_cursor()?;

    result
}

fn run_loop(
    terminal: &mut Terminal<CrosstermBackend<io::Stdout>>,
    app: &mut App,
    tx: mpsc::Sender<BackgroundEvent>,
) -> io::Result<()> {
    loop {
        // Transition through Starting: do sync setup, launch background tasks
        if app.step == Step::Starting && !app.setup_triggered {
            app.setup_triggered = true;
            do_sync_setup(app);
            background::start_all(tx.clone(), app.install_dir.clone(), app.selected_profile());
            app.step = Step::OnboardingName;
        }

        // Auto-advance from Waiting once all background tasks finish
        if app.step == Step::Waiting {
            app.poll_background();
            if app.progress.all_done() {
                do_finalize(app);
                app.step = Step::Done;
            }
        }

        // Poll background events during onboarding too (for the status indicator)
        if matches!(
            app.step,
            Step::OnboardingName
                | Step::OnboardingOccupation
                | Step::OnboardingLocation
                | Step::OnboardingPeople
                | Step::OnboardingProjects
                | Step::OnboardingAdditional
        ) {
            app.poll_background();
        }

        terminal.draw(|f| ui::render(f, app))?;

        if event::poll(Duration::from_millis(100))? {
            if let Event::Key(key) = event::read()? {
                app.handle_key(key);
            }
        }

        if app.should_quit {
            break;
        }
    }

    Ok(())
}

fn do_sync_setup(app: &mut App) {
    let profile = app.selected_profile();

    if let Err(e) = background::write_config(
        &app.install_dir,
        profile,
        app.language.clone(),
        &app.ddns_token.clone(),
        &app.ddns_subdomain.clone(),
    ) {
        app.error = Some(e);
        return;
    }

    if let Err(e) = background::generate_certificates(&app.install_dir) {
        app.error = Some(e);
        return;
    }

    background::setup_mdns(&app.install_dir);
}

fn do_finalize(app: &mut App) {
    if app.finalize_triggered {
        return;
    }
    app.finalize_triggered = true;

    if let Err(e) = background::write_user_profile(&app.install_dir, &app.onboarding) {
        app.error = Some(e);
        return;
    }

    if let Err(e) = background::install_and_start_service(&app.install_dir) {
        app.error = Some(format!("Service install failed (server still works manually): {e}"));
    }
}
