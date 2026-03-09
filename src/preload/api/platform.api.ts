export const platformApi = {
  getPlatform: () => process.platform as 'darwin' | 'win32' | 'linux'
}
