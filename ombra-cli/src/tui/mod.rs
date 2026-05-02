pub mod dashboard;

pub async fn launch() {
    dashboard::run().await;
}
