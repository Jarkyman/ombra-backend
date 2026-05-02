use serde::{Deserialize, Serialize};
use sysinfo::System;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum HardwareProfile {
    Performance,
    Efficiency,
    Edge,
    Nano,
}

impl HardwareProfile {
    pub fn detect() -> Self {
        if std::env::consts::ARCH == "aarch64" {
            return if detect_total_ram_gb() < 3 {
                Self::Nano
            } else {
                Self::Edge
            };
        }

        if detect_total_ram_gb() >= 28 {
            Self::Performance
        } else {
            Self::Efficiency
        }
    }

    pub fn model_filename(&self) -> &'static str {
        match self {
            Self::Performance => "gemma-2-9b-it-Q8_0.gguf",
            Self::Efficiency => "gemma-2-2b-it-Q8_0.gguf",
            Self::Edge => "gemma-2-2b-it-Q4_K_M.gguf",
            Self::Nano => "Qwen2.5-1.5B-Instruct-Q4_K_M.gguf",
        }
    }

    pub fn huggingface_repo(&self) -> &'static str {
        match self {
            Self::Performance => "bartowski/gemma-2-9b-it-GGUF",
            Self::Efficiency | Self::Edge => "bartowski/gemma-2-2b-it-GGUF",
            Self::Nano => "bartowski/Qwen2.5-1.5B-Instruct-GGUF",
        }
    }

    pub fn display_name(&self) -> &'static str {
        match self {
            Self::Performance => "Performance (Gemma-2-9B Q8_0)",
            Self::Efficiency => "Efficiency (Gemma-2-2B Q8_0)",
            Self::Edge => "Edge (Gemma-2-2B Q4_K_M)",
            Self::Nano => "Nano (Qwen2.5-1.5B Q4_K_M)",
        }
    }

    pub fn chat_template(&self) -> &'static str {
        match self {
            Self::Performance | Self::Efficiency | Self::Edge => {
                "<start_of_turn>user\n{prompt}<end_of_turn>\n<start_of_turn>model\n"
            }
            Self::Nano => "<|im_start|>user\n{prompt}<|im_end|>\n<|im_start|>assistant\n",
        }
    }
}

fn detect_total_ram_gb() -> u64 {
    let mut system = System::new();
    system.refresh_memory();
    system.total_memory() / (1024 * 1024 * 1024)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detect_returns_a_valid_variant() {
        let profile = HardwareProfile::detect();
        let name = profile.display_name();
        assert!(!name.is_empty());
    }

    #[test]
    fn all_profiles_have_nonempty_model_filename() {
        for profile in [HardwareProfile::Performance, HardwareProfile::Efficiency, HardwareProfile::Edge, HardwareProfile::Nano] {
            assert!(!profile.model_filename().is_empty());
            assert!(profile.model_filename().ends_with(".gguf"));
        }
    }

    #[test]
    fn all_profiles_have_valid_huggingface_repo() {
        for profile in [HardwareProfile::Performance, HardwareProfile::Efficiency, HardwareProfile::Edge, HardwareProfile::Nano] {
            let repo = profile.huggingface_repo();
            assert!(repo.contains('/'), "repo must be in 'user/repo' format, got: {repo}");
        }
    }

    #[test]
    fn all_profiles_have_nonempty_chat_template() {
        for profile in [HardwareProfile::Performance, HardwareProfile::Efficiency, HardwareProfile::Edge, HardwareProfile::Nano] {
            assert!(!profile.chat_template().is_empty());
        }
    }

    #[test]
    fn nano_profile_detected_on_low_ram_aarch64() {
        if std::env::consts::ARCH == "aarch64" && detect_total_ram_gb() < 3 {
            assert!(matches!(HardwareProfile::detect(), HardwareProfile::Nano));
        }
    }

    #[test]
    fn edge_profile_selected_on_aarch64() {
        if std::env::consts::ARCH == "aarch64" {
            assert!(matches!(HardwareProfile::detect(), HardwareProfile::Edge));
        }
    }
}
