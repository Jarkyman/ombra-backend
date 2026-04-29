use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Key, Nonce,
};
use rand::RngCore;

use crate::error::OmbraError;

pub fn generate_key() -> String {
    let mut key = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut key);
    hex::encode(key)
}

pub fn parse_key(hex_key: &str) -> Result<[u8; 32], OmbraError> {
    let bytes = hex::decode(hex_key)
        .map_err(|e| OmbraError::Storage(format!("parse encryption key: {e}")))?;

    bytes
        .try_into()
        .map_err(|_| OmbraError::Storage("encryption key must be 32 bytes (64 hex chars)".to_string()))
}

pub fn encrypt(plaintext: &str, key: &[u8; 32]) -> Result<String, OmbraError> {
    let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(key));

    let mut nonce_bytes = [0u8; 12];
    rand::thread_rng().fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    let ciphertext = cipher
        .encrypt(nonce, plaintext.as_bytes())
        .map_err(|e| OmbraError::Storage(format!("encrypt: {e}")))?;

    let mut combined = nonce_bytes.to_vec();
    combined.extend_from_slice(&ciphertext);

    Ok(hex::encode(combined))
}

pub fn decrypt(encoded: &str, key: &[u8; 32]) -> Result<String, OmbraError> {
    let combined = hex::decode(encoded)
        .map_err(|e| OmbraError::Storage(format!("hex decode ciphertext: {e}")))?;

    if combined.len() < 12 {
        return Err(OmbraError::Storage("ciphertext too short".to_string()));
    }

    let (nonce_bytes, ciphertext) = combined.split_at(12);
    let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(key));
    let nonce = Nonce::from_slice(nonce_bytes);

    let plaintext = cipher
        .decrypt(nonce, ciphertext)
        .map_err(|_| OmbraError::Storage("decryption failed — wrong key or corrupted data".to_string()))?;

    String::from_utf8(plaintext)
        .map_err(|e| OmbraError::Storage(format!("utf8 decode after decrypt: {e}")))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_key() -> [u8; 32] {
        parse_key(&generate_key()).unwrap()
    }

    #[test]
    fn roundtrip_preserves_content() {
        let key = test_key();
        let original = "We will meet again on Friday at 14:00";
        let encrypted = encrypt(original, &key).unwrap();
        let decrypted = decrypt(&encrypted, &key).unwrap();
        assert_eq!(decrypted, original);
    }

    #[test]
    fn empty_string_roundtrip() {
        let key = test_key();
        let encrypted = encrypt("", &key).unwrap();
        let decrypted = decrypt(&encrypted, &key).unwrap();
        assert_eq!(decrypted, "");
    }

    #[test]
    fn unicode_roundtrip() {
        let key = test_key();
        let original = "æøå ÆØÅ 日本語 العربية";
        let encrypted = encrypt(original, &key).unwrap();
        let decrypted = decrypt(&encrypted, &key).unwrap();
        assert_eq!(decrypted, original);
    }

    #[test]
    fn wrong_key_returns_error() {
        let key_a = test_key();
        let key_b = test_key();
        let encrypted = encrypt("secret content", &key_a).unwrap();
        assert!(decrypt(&encrypted, &key_b).is_err());
    }

    #[test]
    fn ciphertext_too_short_returns_error() {
        let key = test_key();
        assert!(decrypt("aabbcc", &key).is_err());
    }

    #[test]
    fn each_encryption_produces_unique_ciphertext() {
        let key = test_key();
        let plaintext = "same input every time";
        let first = encrypt(plaintext, &key).unwrap();
        let second = encrypt(plaintext, &key).unwrap();
        assert_ne!(first, second, "nonce must be random — identical ciphertexts indicate a nonce reuse bug");
    }

    #[test]
    fn generated_key_is_64_hex_chars() {
        let key = generate_key();
        assert_eq!(key.len(), 64);
        assert!(key.chars().all(|c| c.is_ascii_hexdigit()));
    }

    #[test]
    fn parse_key_rejects_wrong_length() {
        assert!(parse_key("tooshort").is_err());
        assert!(parse_key(&"a".repeat(66)).is_err());
    }
}
