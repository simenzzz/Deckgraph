use sha2::{Sha256, Digest};
use hmac::{Hmac, Mac};
use hex;

type HmacSha256 = Hmac<Sha256>;

pub fn hash_password(password: &str, salt: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(format!("{}{}", password, salt));
    hex::encode(hasher.finalize())
}

pub fn create_hmac(key: &[u8], message: &[u8]) -> String {
    let mut mac = HmacSha256::new_from_slice(key)
        .expect("HMAC key can be any length");
    mac.update(message);
    hex::encode(mac.finalize().into_bytes())
}
