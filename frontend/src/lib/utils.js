// Merge class names, filtering out falsy values
export function cn(...classes) {
  return classes.filter(Boolean).join(' ')
}

// Format a number as Indian Rupees
export function formatRupees(amount) {
  return `Rs.${Number(amount || 0).toLocaleString('en-IN')}`
}

// Format a date string nicely, e.g. "12 Jun 2025"
export function formatDate(dateStr) {
  if (!dateStr) return 'N/A'
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

// Return a human-readable "X days ago" or date
export function timeAgo(dateStr) {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7)  return `${days} days ago`
  return formatDate(dateStr)
}

// Capitalize each word in a string
export function titleCase(str) {
  return (str || '').split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}
