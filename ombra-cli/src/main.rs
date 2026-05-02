mod commands;
mod install;
mod tui;

use clap::Parser;
use commands::OmbraCommand;

#[derive(Parser)]
#[command(name = "ombra", about = "Ombra backend control interface")]
struct OmbraArgs {
    #[command(subcommand)]
    command: OmbraCommand,
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .json()
        .init();

    let args = OmbraArgs::parse();

    match args.command {
        OmbraCommand::Dashboard => tui::launch().await,
        OmbraCommand::Status  => commands::print_status().await,
        OmbraCommand::Upgrade => commands::run_upgrade(),
        OmbraCommand::Install => install::run(),
    }
}
