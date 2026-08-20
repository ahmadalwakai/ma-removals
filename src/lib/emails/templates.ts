const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://maremovals.com";

function wrap(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>MA Removals</title>
</head>
<body style="margin:0;padding:0;background:#F1F5F9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F1F5F9;padding:32px 16px;">
<tr><td align="center">
<table width="100%" style="max-width:600px;background:white;border-radius:16px;overflow:hidden;">
  <!-- Header -->
  <tr>
    <td style="background:#0B1120;padding:24px 32px;text-align:center;">
      <div style="display:inline-flex;align-items:center;gap:10px;">
        <div style="width:36px;height:36px;background:linear-gradient(135deg,#2563EB,#2563EB);border-radius:8px;display:inline-block;"></div>
        <span style="font-size:20px;font-weight:800;color:white;letter-spacing:-0.5px;">MA Removals</span>
      </div>
    </td>
  </tr>
  <!-- Body -->
  <tr><td style="padding:32px;">${content}</td></tr>
  <!-- Footer -->
  <tr>
    <td style="background:#F8FAFC;padding:20px 32px;text-align:center;border-top:1px solid #E2E8F0;">
      <p style="margin:0;font-size:12px;color:#94A3B8;">MA Removals Ltd · Glasgow, Scotland</p>
      <p style="margin:4px 0 0;font-size:12px;color:#94A3B8;">
        <a href="mailto:info@maremovals.co.uk" style="color:#2563EB;">info@maremovals.co.uk</a> · 07426 467 112
      </p>
      <p style="margin:8px 0 0;font-size:11px;color:#CBD5E1;">
        <a href="${BASE_URL}" style="color:#94A3B8;text-decoration:none;">www.maremovals.com</a>
      </p>
    </td>
  </tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function btn(text: string, href: string, color = "#2563EB"): string {
  return `<a href="${href}" style="display:inline-block;padding:12px 28px;background:${color};color:white;border-radius:8px;font-weight:700;font-size:14px;text-decoration:none;margin-top:16px;">${text}</a>`;
}

function h1(text: string): string {
  return `<h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#0B1120;">${text}</h1>`;
}

function p(text: string): string {
  return `<p style="margin:0 0 12px;font-size:15px;color:#334155;line-height:1.6;">${text}</p>`;
}

function detail(label: string, value: string): string {
  return `<tr>
    <td style="padding:6px 0;font-size:13px;color:#64748B;width:140px;">${label}</td>
    <td style="padding:6px 0;font-size:13px;color:#0F172A;font-weight:600;">${value}</td>
  </tr>`;
}

// ─── Booking Confirmed ─────────────────────────────────────────────────────────
export interface BookingConfirmedData {
  customerName: string;
  reference: string;
  serviceName: string;
  scheduledDate: string;
  scheduledTime: string;
  pickupAddress: string;
  dropoffAddress: string;
  totalPaid: number;
}

export function bookingConfirmedHtml(d: BookingConfirmedData): string {
  const body = `
    ${h1("Booking Confirmed! 🎉")}
    ${p(`Hi ${d.customerName}, your booking is confirmed and payment received.`)}
    <div style="background:#2563EB;border:1px solid #2563EB;border-radius:10px;padding:20px;margin:20px 0;">
      <p style="margin:0 0 12px;font-size:13px;font-weight:700;color:#2563EB;text-transform:uppercase;letter-spacing:0.05em;">Booking Details</p>
      <table width="100%" cellpadding="0" cellspacing="0">
        ${detail("Reference", d.reference)}
        ${detail("Service", d.serviceName)}
        ${detail("Date", d.scheduledDate)}
        ${detail("Time", d.scheduledTime)}
        ${detail("Pickup", d.pickupAddress)}
        ${detail("Dropoff", d.dropoffAddress)}
        ${detail("Total Paid", `£${d.totalPaid.toFixed(2)}`)}
      </table>
    </div>
    ${p("We'll notify you as soon as a driver is assigned. If you have any questions, reply to this email.")}
    ${btn("Track Your Booking", `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://maremovals.com"}/booking/track`)}
    <p style="margin-top:24px;font-size:12px;color:#94A3B8;">Free cancellation 48h+ before your move. 50% refund 24–48h. No refund within 24h.</p>
  `;
  return wrap(body);
}

// ─── Booking Cancelled ─────────────────────────────────────────────────────────
export interface BookingCancelledData {
  customerName: string;
  reference: string;
  serviceName: string;
  scheduledDate: string;
  refundNote: string;
}

export function bookingCancelledHtml(d: BookingCancelledData): string {
  const body = `
    ${h1("Booking Cancelled")}
    ${p(`Hi ${d.customerName}, your booking <strong>${d.reference}</strong> has been cancelled.`)}
    <div style="background:#FEF2F2;border:1px solid #FECACA;border-radius:10px;padding:20px;margin:20px 0;">
      <table width="100%" cellpadding="0" cellspacing="0">
        ${detail("Reference", d.reference)}
        ${detail("Service", d.serviceName)}
        ${detail("Date", d.scheduledDate)}
        ${detail("Refund", d.refundNote)}
      </table>
    </div>
    ${p("We're sorry to see you go. If you'd like to re-book in the future, we'd love to help.")}
    ${btn("Book Again", `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://maremovals.com"}/book`, "#F59E0B")}
  `;
  return wrap(body);
}

// ─── Driver Assigned ───────────────────────────────────────────────────────────
export interface DriverAssignedData {
  customerName: string;
  reference: string;
  driverFirstName: string;
  scheduledDate: string;
  scheduledTime: string;
}

export function driverAssignedHtml(d: DriverAssignedData): string {
  const body = `
    ${h1("Your Driver is Confirmed! 🚛")}
    ${p(`Hi ${d.customerName}, great news — a driver has been assigned to your booking.`)}
    <div style="background:#2563EB;border:1px solid #2563EB;border-radius:10px;padding:20px;margin:20px 0;">
      <table width="100%" cellpadding="0" cellspacing="0">
        ${detail("Booking Ref", d.reference)}
        ${detail("Driver", d.driverFirstName)}
        ${detail("Date", d.scheduledDate)}
        ${detail("Expected", d.scheduledTime)}
      </table>
    </div>
    ${p("You can message your driver through the booking tracking page.")}
    ${btn("Message Your Driver", `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://maremovals.com"}/booking/track`)}
  `;
  return wrap(body);
}

// ─── Driver New Job ─────────────────────────────────────────────────────────────
export interface DriverNewJobData {
  driverName: string;
  reference: string;
  serviceName: string;
  scheduledDate: string;
  pickupPostcode: string;
  dropoffPostcode: string;
  quotedPrice: number;
}

export function driverNewJobHtml(d: DriverNewJobData): string {
  const body = `
    ${h1("New Job Assigned 📦")}
    ${p(`Hi ${d.driverName}, a new job has been assigned to you.`)}
    <div style="background:#2563EB;border:1px solid #2563EB;border-radius:10px;padding:20px;margin:20px 0;">
      <table width="100%" cellpadding="0" cellspacing="0">
        ${detail("Reference", d.reference)}
        ${detail("Service", d.serviceName)}
        ${detail("Date", d.scheduledDate)}
        ${detail("Pickup", d.pickupPostcode)}
        ${detail("Dropoff", d.dropoffPostcode)}
        ${detail("Earnings", `£${d.quotedPrice.toFixed(2)}`)}
      </table>
    </div>
    ${btn("View Job", `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://maremovals.com"}/driver/my-jobs`)}
  `;
  return wrap(body);
}

// ─── Job Completed ─────────────────────────────────────────────────────────────
export interface JobCompletedData {
  customerName: string;
  reference: string;
  serviceName: string;
}

export function jobCompletedHtml(d: JobCompletedData): string {
  const body = `
    ${h1("Your Move is Complete! ✅")}
    ${p(`Hi ${d.customerName}, your ${d.serviceName} (${d.reference}) has been completed. We hope the move went smoothly!`)}
    ${p("We'd love to hear about your experience. It only takes 30 seconds.")}
    ${btn("Rate Your Experience", `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://maremovals.com"}/booking/review/${d.reference}`)}
    <p style="margin-top:16px;font-size:13px;color:#64748B;">You can also download your invoice from the tracking page.</p>
    ${btn("Download Invoice", `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://maremovals.com"}/booking/track`, "#64748B")}
  `;
  return wrap(body);
}

// ─── New Message ───────────────────────────────────────────────────────────────
export interface NewMessageData {
  recipientName: string;
  senderName: string;
  reference: string;
  messagePreview: string;
}

export function newMessageHtml(d: NewMessageData): string {
  const body = `
    ${h1("New Message 💬")}
    ${p(`Hi ${d.recipientName}, <strong>${d.senderName}</strong> sent you a message about booking <strong>${d.reference}</strong>:`)}
    <div style="background:#F8FAFC;border-left:4px solid #2563EB;border-radius:6px;padding:16px;margin:16px 0;font-size:14px;color:#334155;font-style:italic;">
      "${d.messagePreview}"
    </div>
    ${btn("Reply Now", `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://maremovals.com"}/booking/track`)}
  `;
  return wrap(body);
}

// ─── Driver Welcome ─────────────────────────────────────────────────────────────
export interface DriverWelcomeData {
  driverName: string;
  email: string;
  temporaryPassword: string;
}

export function driverWelcomeHtml(d: DriverWelcomeData): string {
  const body = `
    ${h1("Welcome to MA Removals! 🚛")}
    ${p(`Hi ${d.driverName}, your driver account has been created. Here are your login details:`)}
    <div style="background:#2563EB;border:1px solid #2563EB;border-radius:10px;padding:20px;margin:20px 0;">
      <table width="100%" cellpadding="0" cellspacing="0">
        ${detail("Email", d.email)}
        ${detail("Password", d.temporaryPassword)}
      </table>
    </div>
    ${p("Please log in and change your password as soon as possible.")}
    ${btn("Login to Driver Portal", `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://maremovals.com"}/driver-login`)}
  `;
  return wrap(body);
}

// ─── Password Reset ─────────────────────────────────────────────────────────────
export interface PasswordResetData {
  name: string;
  resetLink: string;
}

export function passwordResetHtml(d: PasswordResetData): string {
  const body = `
    ${h1("Reset Your Password")}
    ${p(`Hi ${d.name}, we received a request to reset your password. Click below to set a new one. This link is valid for 1 hour.`)}
    ${btn("Reset Password", d.resetLink, "#EF4444")}
    ${p("If you didn't request this, you can safely ignore this email. Your password won't change.")}
  `;
  return wrap(body);
}

// ─── Invoice Email ──────────────────────────────────────────────────────────────
export interface InvoiceEmailData {
  customerName: string;
  reference: string;
  totalPaid: number;
}

export function invoiceEmailHtml(d: InvoiceEmailData): string {
  const body = `
    ${h1("Your Invoice 🧾")}
    ${p(`Hi ${d.customerName}, please find your invoice for booking <strong>${d.reference}</strong> (£${d.totalPaid.toFixed(2)}) attached.`)}
    ${btn("Download Invoice", `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://maremovals.com"}/api/booking/invoice/${d.reference}`)}
  `;
  return wrap(body);
}
