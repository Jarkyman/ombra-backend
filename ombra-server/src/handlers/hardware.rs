use axum::{Json, response::IntoResponse};
use serde::Serialize;
use sysinfo::{CpuRefreshKind, Disks, MemoryRefreshKind, RefreshKind, System};

#[derive(Serialize)]
pub struct DiskMetric {
    pub mount: String,
    pub label: String,
    pub used_bytes: u64,
    pub total_bytes: u64,
}

#[derive(Serialize)]
pub struct HardwareResponse {
    pub cores: Vec<f32>,
    pub cpu_freq_mhz: u64,
    pub ram_used_bytes: u64,
    pub ram_total_bytes: u64,
    pub disks: Vec<DiskMetric>,
}

pub async fn get() -> impl IntoResponse {
    let mut sys = System::new_with_specifics(
        RefreshKind::new()
            .with_cpu(CpuRefreshKind::everything())
            .with_memory(MemoryRefreshKind::everything()),
    );

    tokio::time::sleep(std::time::Duration::from_millis(120)).await;
    sys.refresh_specifics(
        RefreshKind::new()
            .with_cpu(CpuRefreshKind::everything())
            .with_memory(MemoryRefreshKind::everything()),
    );

    let cores: Vec<f32> = sys.cpus().iter().map(|c| c.cpu_usage()).collect();
    let cpu_freq_mhz = sys.cpus().first().map(|c| c.frequency()).unwrap_or(0);
    let ram_used_bytes = sys.used_memory();
    let ram_total_bytes = sys.total_memory();

    let mut disks_info = Disks::new_with_refreshed_list();
    disks_info.refresh();

    let disks = disks_info
        .iter()
        .map(|d| DiskMetric {
            mount: d.mount_point().to_string_lossy().to_string(),
            label: d.name().to_string_lossy().to_string(),
            used_bytes: d.total_space() - d.available_space(),
            total_bytes: d.total_space(),
        })
        .collect();

    Json(HardwareResponse {
        cores,
        cpu_freq_mhz,
        ram_used_bytes,
        ram_total_bytes,
        disks,
    })
    .into_response()
}
