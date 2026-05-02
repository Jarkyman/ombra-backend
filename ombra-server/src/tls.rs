use std::io::BufReader;
use std::sync::Arc;

use rustls::pki_types::{CertificateDer, PrivateKeyDer};
use rustls::server::WebPkiClientVerifier;
use rustls::{RootCertStore, ServerConfig};

use ombra_common::{config::AppConfig, error::OmbraError};

pub fn build_mtls_server_config(config: &AppConfig) -> Result<Arc<ServerConfig>, OmbraError> {
    let server_certs = load_certs_from_file(&config.tls_server_cert_path)?;
    let server_key = load_private_key_from_file(&config.tls_server_key_path)?;
    let client_ca_certs = load_certs_from_file(&config.tls_client_ca_cert_path)?;

    let mut client_cert_store = RootCertStore::empty();
    for cert in client_ca_certs {
        client_cert_store
            .add(cert)
            .map_err(|e| OmbraError::Network(format!("add client CA cert: {e}")))?;
    }

    let client_verifier = WebPkiClientVerifier::builder(client_cert_store.into())
        .build()
        .map_err(|e| OmbraError::Network(format!("build client verifier: {e}")))?;

    let server_config = ServerConfig::builder()
        .with_client_cert_verifier(client_verifier)
        .with_single_cert(server_certs, server_key)
        .map_err(|e| OmbraError::Network(format!("build TLS server config: {e}")))?;

    Ok(Arc::new(server_config))
}

fn load_certs_from_file(
    path: &std::path::Path,
) -> Result<Vec<CertificateDer<'static>>, OmbraError> {
    let file = std::fs::File::open(path)
        .map_err(|e| OmbraError::Network(format!("open cert {}: {e}", path.display())))?;

    rustls_pemfile::certs(&mut BufReader::new(file))
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| OmbraError::Network(format!("parse cert {}: {e}", path.display())))
}

fn load_private_key_from_file(
    path: &std::path::Path,
) -> Result<PrivateKeyDer<'static>, OmbraError> {
    let file = std::fs::File::open(path)
        .map_err(|e| OmbraError::Network(format!("open key {}: {e}", path.display())))?;

    rustls_pemfile::private_key(&mut BufReader::new(file))
        .map_err(|e| OmbraError::Network(format!("parse key {}: {e}", path.display())))?
        .ok_or_else(|| OmbraError::Network(format!("no private key in {}", path.display())))
}
