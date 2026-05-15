const nodemailer = require('nodemailer');

// ── Transporter (created lazily so missing creds don't crash boot) ──
function createTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_PASS,
    },
  });
}

// ── Shared style tokens ────────────────────────────────────────
const GOLD    = '#d4a847';
const BG      = '#16161c';
const SURFACE = '#1f1f26';
const TEXT    = '#f4f2ed';
const MUTED   = '#9a9a9f';

// ── Base layout wrapper ────────────────────────────────────────
function layout(bodyContent) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>B777 Auto Detailing</title>
</head>
<body style="margin:0;padding:0;background:${BG};font-family:Arial,sans-serif;color:${TEXT}">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:${BG};padding:40px 20px">
    <tr><td align="center">

      <!-- Card -->
      <table width="600" cellpadding="0" cellspacing="0"
             style="max-width:600px;background:${SURFACE};border-radius:12px;
                    border:1px solid rgba(255,255,255,0.08);overflow:hidden">

        <!-- Header bar -->
        <tr>
          <td style="background:${GOLD};padding:20px 32px">
            <p style="margin:0;font-size:22px;font-weight:800;letter-spacing:0.06em;
                       text-transform:uppercase;color:#111">
              B777 Auto Detailing
            </p>
          </td>
        </tr>

        <!-- Body -->
        <tr><td style="padding:36px 32px">${bodyContent}</td></tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 32px;border-top:1px solid rgba(255,255,255,0.08);
                     font-size:12px;color:${MUTED};text-align:center">
            B777 Auto Detailing &nbsp;·&nbsp;
            <a href="tel:5722050612" style="color:${GOLD}">572-205-6012</a>
            &nbsp;·&nbsp;
            <a href="mailto:capt.marwan@hotmail.com" style="color:${GOLD}">capt.marwan@hotmail.com</a>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── Shared detail-table builder ────────────────────────────────
function detailTable(rows) {
  const rowsHtml = rows.map(([label, value], i) => `
    <tr style="background:${i % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'transparent'}">
      <td style="padding:10px 14px;font-size:12px;font-weight:700;text-transform:uppercase;
                 letter-spacing:0.08em;color:${MUTED};white-space:nowrap;width:160px">
        ${label}
      </td>
      <td style="padding:10px 14px;font-size:14px;color:${TEXT}">${value}</td>
    </tr>
  `).join('');

  return `
    <table width="100%" cellpadding="0" cellspacing="0"
           style="border-collapse:collapse;border:1px solid rgba(255,255,255,0.08);
                  border-radius:8px;overflow:hidden;margin-top:20px">
      ${rowsHtml}
    </table>
  `;
}

// ── 1. Customer confirmation email ─────────────────────────────
function buildCustomerEmail(b) {
  const vehicle = `${b.vehicle_color} ${b.vehicle_make} ${b.vehicle_model}`;

  const body = `
    <h1 style="margin:0 0 6px;font-size:26px;font-weight:800;color:${GOLD};
               text-transform:uppercase;letter-spacing:0.04em">
      Booking Request Received
    </h1>
    <p style="margin:0 0 24px;font-size:15px;color:${MUTED}">
      Hi ${b.customer_name}, we've got your request and will be in touch shortly.
    </p>

    <p style="margin:0 0 8px;font-size:14px;color:${TEXT}">
      <strong>Your booking summary:</strong>
    </p>

    ${detailTable([
      ['Service',  b.service_type],
      ['Price',    `<strong style="color:${GOLD}">$${b.service_price}</strong>`],
      ['Duration', `${b.service_duration} minutes`],
      ['Vehicle',  vehicle],
      ['Date',     b.booking_date],
      ['Time',     b.booking_time],
      ['Address',  b.service_address],
      ['Status',   `<span style="background:rgba(212,168,71,0.18);color:${GOLD};
                       padding:2px 10px;border-radius:20px;font-size:12px;font-weight:700;
                       text-transform:uppercase;letter-spacing:0.06em">Pending</span>`],
    ])}

    <div style="margin-top:28px;padding:20px 24px;background:rgba(212,168,71,0.07);
                border-left:3px solid ${GOLD};border-radius:4px">
      <p style="margin:0 0 8px;font-size:14px;font-weight:700;color:${GOLD}">
        Next step — confirm your appointment
      </p>
      <p style="margin:0;font-size:13px;color:${MUTED};line-height:1.6">
        Simply <strong style="color:${TEXT}">reply to this email</strong> or call/text
        <a href="tel:5722050612" style="color:${GOLD}">572-205-6012</a>
        to confirm. Once confirmed, we'll send a final reminder 24 hours before your appointment.
      </p>
    </div>

    <p style="margin:28px 0 0;font-size:13px;color:${MUTED};line-height:1.6">
      Need to reschedule or cancel? Contact us at least 24 hours in advance and we'll
      sort it out with no hassle.
    </p>
  `;

  return layout(body);
}

// ── 2. Owner notification email ────────────────────────────────
function buildOwnerEmail(b) {
  const vehicle = `${b.vehicle_color} ${b.vehicle_make} ${b.vehicle_model}`;

  const body = `
    <h1 style="margin:0 0 6px;font-size:26px;font-weight:800;color:${GOLD};
               text-transform:uppercase;letter-spacing:0.04em">
      New Booking #${b.id}
    </h1>
    <p style="margin:0 0 24px;font-size:15px;color:${MUTED}">
      A new booking request was just submitted.
    </p>

    <p style="margin:0 0 8px;font-size:13px;font-weight:700;text-transform:uppercase;
              letter-spacing:0.1em;color:${MUTED}">
      Customer
    </p>
    ${detailTable([
      ['Name',  b.customer_name],
      ['Email', `<a href="mailto:${b.customer_email}" style="color:${GOLD}">${b.customer_email}</a>`],
      ['Phone', `<a href="tel:${b.customer_phone}" style="color:${GOLD}">${b.customer_phone}</a>`],
    ])}

    <p style="margin:24px 0 8px;font-size:13px;font-weight:700;text-transform:uppercase;
              letter-spacing:0.1em;color:${MUTED}">
      Appointment
    </p>
    ${detailTable([
      ['Service',   b.service_type],
      ['Price',     `<strong style="color:${GOLD}">$${b.service_price}</strong>`],
      ['Duration',  `${b.service_duration} min`],
      ['Date',      `<strong>${b.booking_date}</strong>`],
      ['Time',      `<strong>${b.booking_time}</strong>`],
      ['Address',   b.service_address],
      ['Deposit',   b.deposit_paid ? '✓ Paid' : 'Not paid'],
    ])}

    <p style="margin:24px 0 8px;font-size:13px;font-weight:700;text-transform:uppercase;
              letter-spacing:0.1em;color:${MUTED}">
      Vehicle
    </p>
    ${detailTable([
      ['Make',  b.vehicle_make],
      ['Model', b.vehicle_model],
      ['Color', b.vehicle_color],
      ['Full',  vehicle],
    ])}

    <div style="margin-top:28px;padding:20px 24px;background:rgba(212,168,71,0.07);
                border-left:3px solid ${GOLD};border-radius:4px">
      <p style="margin:0 0 6px;font-size:14px;font-weight:700;color:${GOLD}">Action needed</p>
      <p style="margin:0;font-size:13px;color:${MUTED};line-height:1.6">
        Reply to the customer at
        <a href="mailto:${b.customer_email}" style="color:${GOLD}">${b.customer_email}</a>
        or call <a href="tel:${b.customer_phone}" style="color:${GOLD}">${b.customer_phone}</a>
        to confirm this booking. Their status is currently
        <strong style="color:${GOLD}">Pending</strong>.
      </p>
    </div>
  `;

  return layout(body);
}

// ── Public send function ───────────────────────────────────────
async function sendBookingEmails(booking) {
  const gmailUser  = process.env.GMAIL_USER;
  const gmailPass  = process.env.GMAIL_PASS;
  const ownerEmail = process.env.OWNER_EMAIL;

  if (!gmailUser || !gmailPass) {
    console.warn('[email] GMAIL_USER / GMAIL_PASS not set — skipping notifications');
    return;
  }

  const transporter = createTransporter();

  // ── Customer confirmation ──────────────────────────────────
  await transporter.sendMail({
    from:    `"B777 Auto Detailing" <${gmailUser}>`,
    to:      booking.customer_email,
    replyTo: ownerEmail || gmailUser,
    subject: `Booking Request Received — ${booking.service_type} on ${booking.booking_date}`,
    html:    buildCustomerEmail(booking),
  });

  // ── Owner notification ─────────────────────────────────────
  await transporter.sendMail({
    from:    `"B777 Bookings" <${gmailUser}>`,
    to:      ownerEmail || gmailUser,
    replyTo: booking.customer_email,
    subject: `New Booking #${booking.id} — ${booking.customer_name} / ${booking.service_type} / ${booking.booking_date}`,
    html:    buildOwnerEmail(booking),
  });

  console.log(`[email] Sent confirmation to ${booking.customer_email} and notification to ${ownerEmail}`);
}

module.exports = { sendBookingEmails };
