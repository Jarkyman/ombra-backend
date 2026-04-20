use clap::Subcommand;

#[derive(Subcommand)]
pub enum OmbraCommand {
    Dashboard,
    Status,
}

pub async fn print_status() {
    println!("Ombra backend status: not yet implemented");
}
