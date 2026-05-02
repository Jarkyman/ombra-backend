use std::net::{IpAddr, Ipv4Addr, Ipv6Addr, SocketAddr};

use axum::{
    extract::{ConnectInfo, State},
    http::StatusCode,
    middleware::Next,
    response::{IntoResponse, Response},
};
use ombra_common::config::RemoteAccessMode;

use crate::state::AppState;

pub async fn require_lan(
    State(state): State<AppState>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    request: axum::extract::Request,
    next: Next,
) -> Response {
    let mode = {
        let config = state.config.read().unwrap();
        config.remote_access_mode.clone()
    };

    let allowed = is_lan_ip(addr.ip())
        || (matches!(mode, RemoteAccessMode::Tailscale) && is_tailscale_cgnat(addr.ip()));

    if allowed {
        next.run(request).await
    } else {
        tracing::warn!(
            ip = %addr.ip(),
            component = "admin",
            "rejected non-LAN request to admin panel"
        );
        (
            StatusCode::FORBIDDEN,
            axum::Json(serde_json::json!({"error": "admin_panel_lan_only"})),
        )
            .into_response()
    }
}

fn is_lan_ip(ip: IpAddr) -> bool {
    let ip = normalize_ipv4_mapped(ip);
    match ip {
        IpAddr::V4(ip) => is_lan_ipv4(ip),
        IpAddr::V6(ip) => is_lan_ipv6(ip),
    }
}

fn is_tailscale_cgnat(ip: IpAddr) -> bool {
    let ip = normalize_ipv4_mapped(ip);
    if let IpAddr::V4(v4) = ip {
        let o = v4.octets();
        // 100.64.0.0/10
        return o[0] == 100 && o[1] >= 64 && o[1] <= 127;
    }
    false
}

fn normalize_ipv4_mapped(ip: IpAddr) -> IpAddr {
    if let IpAddr::V6(v6) = ip {
        if let Some(v4) = v6.to_ipv4_mapped() {
            return IpAddr::V4(v4);
        }
    }
    ip
}

fn is_lan_ipv4(ip: Ipv4Addr) -> bool {
    let o = ip.octets();
    ip.is_loopback()                                   // 127.0.0.0/8
        || o[0] == 10                                  // 10.0.0.0/8
        || (o[0] == 172 && (16..=31).contains(&o[1])) // 172.16.0.0/12
        || (o[0] == 192 && o[1] == 168)               // 192.168.0.0/16
        || (o[0] == 169 && o[1] == 254)               // 169.254.0.0/16 link-local
}

fn is_lan_ipv6(ip: Ipv6Addr) -> bool {
    let o = ip.octets();
    ip.is_loopback()                                 // ::1
        || (o[0] & 0xfe) == 0xfc                     // fc00::/7 ULA
        || (o[0] == 0xfe && (o[1] & 0xc0) == 0x80)  // fe80::/10 link-local
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::net::IpAddr;

    #[test]
    fn loopback_is_lan() {
        assert!(is_lan_ip("127.0.0.1".parse().unwrap()));
        assert!(is_lan_ip("::1".parse().unwrap()));
    }

    #[test]
    fn private_ranges_are_lan() {
        assert!(is_lan_ip("10.0.0.1".parse().unwrap()));
        assert!(is_lan_ip("10.255.255.255".parse().unwrap()));
        assert!(is_lan_ip("172.16.0.1".parse().unwrap()));
        assert!(is_lan_ip("172.31.255.255".parse().unwrap()));
        assert!(is_lan_ip("192.168.1.100".parse().unwrap()));
    }

    #[test]
    fn public_ips_are_not_lan() {
        assert!(!is_lan_ip("8.8.8.8".parse().unwrap()));
        assert!(!is_lan_ip("1.1.1.1".parse().unwrap()));
        assert!(!is_lan_ip("172.32.0.1".parse().unwrap()));
        assert!(!is_lan_ip("11.0.0.1".parse().unwrap()));
    }

    #[test]
    fn ipv4_mapped_ipv6_is_handled() {
        let v4_mapped: IpAddr = "::ffff:192.168.1.1".parse().unwrap();
        assert!(is_lan_ip(v4_mapped));
        let public_mapped: IpAddr = "::ffff:8.8.8.8".parse().unwrap();
        assert!(!is_lan_ip(public_mapped));
    }

    #[test]
    fn tailscale_cgnat_range() {
        assert!(is_tailscale_cgnat("100.64.0.1".parse().unwrap()));
        assert!(is_tailscale_cgnat("100.100.0.1".parse().unwrap()));
        assert!(is_tailscale_cgnat("100.127.255.255".parse().unwrap()));
        assert!(!is_tailscale_cgnat("100.63.255.255".parse().unwrap()));
        assert!(!is_tailscale_cgnat("100.128.0.0".parse().unwrap()));
        assert!(!is_tailscale_cgnat("192.168.1.1".parse().unwrap()));
    }
}
