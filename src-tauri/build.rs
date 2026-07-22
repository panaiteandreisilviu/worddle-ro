fn main() {
  let target = std::env::var("TARGET").unwrap_or_default();
  if target.contains("android") {
    // Android 15+ / Google Play: native libs must support 16 KB page sizes.
    // NDK r27 defaults to 4 KB; inject linker flags so LOAD segments align to 16 KB.
    println!("cargo:rustc-link-arg=-Wl,-z,max-page-size=16384");
    println!("cargo:rustc-link-arg=-Wl,-z,common-page-size=16384");
  }

  tauri_build::build()
}
