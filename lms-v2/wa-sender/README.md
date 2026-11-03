# Darts LMS WhatsApp sender

Sends the LMS WhatsApp queue from Roshan's own WhatsApp, with no WhatsApp Business API and no cost.
It runs on the laptop as a WhatsApp "linked device" (the same way WhatsApp Web works), using the Baileys library.

## Set up (once, about 5 minutes)

1. Install Node.js LTS from https://nodejs.org (if `start.bat` says it's missing).
2. Copy this `wa-sender` folder to the laptop, for example to the Desktop.
3. In the LMS admin (lms.roshanshaji.com/#/admin): **WhatsApp > Auto sender > Make sender key**. Copy the key.
4. Double-click **start.bat**. Paste the key when it asks.
5. A QR code opens. On your phone: **WhatsApp > Settings > Linked devices > Link a device**, scan it.
6. The window says "Sending is ON". Leave it open (you can minimise it).

Next time, just double-click `start.bat`. No QR again unless you unlink the laptop from your phone.

## Using it

In the admin, compose a message as usual and keep **Send automatically from my laptop** ticked.
The sender works through the queue by itself. Messages wait if the laptop is off and go out when you start it again.
"Send automatically" also appears after adding a student, for the login PIN message.

## Safety limits (to protect the number)

- One message every 25 to 60 seconds, with "typing…" first.
- At most 120 a day (set `WA_DAILY_CAP` to change), only 8 AM to 10 PM IST.
- Checks the number is on WhatsApp first; failed messages show in **Send queue > Not sent** with the reason.

This is not WhatsApp's official API. WhatsApp can ban numbers that bulk-message strangers.
Messaging your own students, who already chat with you, at this pace is low risk but not zero.

## Turning it off

- Close the window, or
- In the admin: **Auto sender > Turn off the auto sender** (the key stops working at once), or
- On the phone: **Linked devices > Darts LMS > Log out**.

## What the laptop can access

Only the queue: the sender key can take the next queued message and report the result.
It can't read students, fees or PINs. The WhatsApp link is stored in `wa-login/` on the laptop; delete that folder to unlink.
