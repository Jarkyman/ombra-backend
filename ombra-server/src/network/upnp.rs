use std::net::{Ipv4Addr, SocketAddrV4, UdpSocket};

use igd::aio::search_gateway;
use igd::{PortMappingProtocol, SearchOptions};

const LEASE_DURATION_SECS: u32 = 0; // permanent

pub async fn attempt_port_mapping(port: u16) {
    let local_ip = match detect_local_ip() {
        Some(ip) => ip,
        None => {
            tracing::warn!(component = "upnp", "could not detect local IP — skipping UPnP");
            return;
        }
    };

    let gateway = match search_gateway(SearchOptions::default()).await {
        Ok(gw) => gw,
        Err(e) => {
            tracing::warn!(component = "upnp", %e, "no UPnP gateway found — port must be forwarded manually");
            return;
        }
    };

    let addr = SocketAddrV4::new(local_ip, port);

    match gateway
        .add_port(PortMappingProtocol::TCP, port, addr, LEASE_DURATION_SECS, "ombra-server")
        .await
    {
        Ok(_) => tracing::info!(component = "upnp", %local_ip, port, "UPnP port mapping established"),
        Err(e) => tracing::warn!(component = "upnp", %e, port, "UPnP port mapping failed — port must be forwarded manually"),
    }
}

fn detect_local_ip() -> Option<Ipv4Addr> {
    let socket = UdpSocket::bind("0.0.0.0:0").ok()?;
    socket.connect("8.8.8.8:80").ok()?;
    match socket.local_addr().ok()?.ip() {
        std::net::IpAddr::V4(ip) => Some(ip),
        _ => None,
    }
}
