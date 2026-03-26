import { Resend } from 'resend'
const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendManagerInvite({ to, name, inviteUrl, pgName }) {
  return resend.emails.send({
    from: process.env.FROM_EMAIL,
    to,
    subject: `You are invited to manage ${pgName}`,
    html: `<h2>Hello ${name},</h2><p>You have been invited to manage <strong>${pgName}</strong> on PGManager.</p><p><a href="${inviteUrl}" style="background:#2563EB;color:white;padding:12px 24px;border-radius:8px;text-decoration:none">Accept Invitation</a></p>`
  })
}

export async function sendTenantApproval({ to, name, pgName }) {
  return resend.emails.send({
    from: process.env.FROM_EMAIL,
    to,
    subject: `Your application has been approved - ${pgName}`,
    html: `<h2>Hello ${name},</h2><p>Your application for <strong>${pgName}</strong> has been approved. You can now log in and access all features.</p>`
  })
}

export async function sendRentReminder({ to, name, month, amount, pgName }) {
  return resend.emails.send({
    from: process.env.FROM_EMAIL,
    to,
    subject: `Rent reminder for ${month} - ${pgName}`,
    html: `<h2>Hello ${name},</h2><p>This is a reminder that your rent of <strong>Rs ${amount}</strong> for ${month} is due. Please pay at your earliest convenience.</p>`
  })
}
