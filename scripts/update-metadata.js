module.exports = function configureUpdateMetadata(context) {
  if (context.electronPlatformName !== "darwin") return;
  const options = context.packager.platformSpecificBuildOptions;
  if (options.minimumSystemVersion !== "13.0.0") {
    throw new Error(
      "Review the updater's Darwin minimum when changing macOS support.",
    );
  }
  // The updater compares os.release() (Darwin 22 for macOS 13), while the
  // app's Info.plist uses the macOS version. electron-builder's config schema
  // omits this supported UpdateInfo field, so supply it after config validation
  // and before artifact/update metadata generation. Preserve release notes.
  options.releaseInfo = {
    ...(options.releaseInfo ?? context.packager.config.releaseInfo),
    minimumSystemVersion: "22.0.0",
  };
};
