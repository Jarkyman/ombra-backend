use std::sync::OnceLock;

use lingua::{LanguageDetector, LanguageDetectorBuilder};

static DETECTOR: OnceLock<LanguageDetector> = OnceLock::new();

fn detector() -> &'static LanguageDetector {
    DETECTOR.get_or_init(|| {
        LanguageDetectorBuilder::from_all_spoken_languages().build()
    })
}

pub fn detect_iso639(texts: &[&str]) -> String {
    let combined = texts.join(" ");
    if combined.trim().is_empty() {
        return "unknown".to_string();
    }

    detector()
        .detect_language_of(&combined)
        .map(|lang| lang.iso_code_639_1().to_string())
        .unwrap_or_else(|| "unknown".to_string())
}
