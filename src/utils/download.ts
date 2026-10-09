export const downloadFile = (filename: string, content: string, type: string) => {
  const link = document.createElement('a')
  link.href = URL.createObjectURL(new Blob([content], { type }))
  link.download = filename
  link.click()
  URL.revokeObjectURL(link.href)
}
