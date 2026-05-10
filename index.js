const express = require("express");
const fetch = require("node-fetch");
const app = express();
app.use(express.json());

const TOKEN = "YOUR_WHATSAPP_TOKEN";
const PHONE_ID = "YOUR_PHONE_ID";
const OWNER_NUMBER = "92XXXXXXXXXX"; // Your number
const YOUR_NUMBER = "923001234567"; // Customer care number

// Store user sessions
const sessions = {};

async function sendMessage(to, text) {
  await fetch(
    `https://graph.facebook.com/v17.0/${PHONE_ID}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: text },
      }),
    }
  );
}

async function handleMessage(from, text) {
  const msg = text.trim().toLowerCase();

  // Step 1 - Welcome
  if (!sessions[from]) {
    sessions[from] = { step: "main" };
    await sendMessage(from,
      `👋 Hello! How can I help you?\n\nPlease choose an option:\n1️⃣ Customer Care\n2️⃣ Booking`
    );
    return;
  }

  const session = sessions[from];

  // Step 2 - Main Menu
  if (session.step === "main") {
    if (msg === "1") {
      await sendMessage(from,
        `📞 Customer Care\nPlease contact us at:\nwa.me/${YOUR_NUMBER}`
      );
      delete sessions[from];
    } else if (msg === "2") {
      session.step = "amount";
      await sendMessage(from,
        `💰 Choose your booking amount:\n1️⃣ 30\n2️⃣ 60\n3️⃣ 100`
      );
    }
    return;
  }

  // Step 3 - Amount
  if (session.step === "amount") {
    const amounts = { "1": 30, "2": 60, "3": 100 };
    if (amounts[msg]) {
      session.amount = amounts[msg];
      session.step = "timeslot";
      await sendMessage(from,
        `🕐 Choose your IDP Time Slot:\n1️⃣ 3-5 PM\n2️⃣ 5-7 PM\n3️⃣ 7-9 PM`
      );
    } else {
      await sendMessage(from, "❌ Invalid option. Send 1, 2 or 3.");
    }
    return;
  }

  // Step 4 - Time Slot
  if (session.step === "timeslot") {
    const slots = { "1": "3-5 PM", "2": "5-7 PM", "3": "7-9 PM" };
    if (slots[msg]) {
      session.slot = slots[msg];
      session.step = "payment_pending";

      // Notify owner
      await sendMessage(OWNER_NUMBER,
        `🔔 New Booking Request!\nFrom: ${from}\nAmount: ${session.amount}\nSlot: ${session.slot}\n\nReply with:\ngrant ${from} — to approve\ndeny ${from} — to reject`
      );

      // Send QR to user
      await sendMessage(from,
        `✅ Booking Details:\n💰 Amount: Rs. ${session.amount}\n🕐 Slot: ${session.slot}\n\n📲 *Payment via QR:*\n[Your QR Code Image Here]\n\nAfter payment, please wait for manual verification.\n⏳ We will confirm your booking shortly.`
      );
    } else {
      await sendMessage(from, "❌ Invalid option. Send 1, 2 or 3.");
    }
    return;
  }
}

// Owner grants/denies access
async function handleOwnerCommand(text) {
  const parts = text.split(" ");
  const command = parts[0].toLowerCase();
  const userNumber = parts[1];

  if (command === "grant" && sessions[userNumber]) {
    await sendMessage(userNumber,
      `✅ Payment Verified!\n\n🎉 Welcome! Here is your Community Link:\nhttps://chat.whatsapp.com/YOUR_LINK`
    );
    delete sessions[userNumber];
  } else if (command === "deny" && sessions[userNumber]) {
    await sendMessage(userNumber,
      `❌ Payment not verified. Please try again or contact support.`
    );
    delete sessions[userNumber];
  }
}

// Webhook
app.post("/webhook", async (req, res) => {
  const entry = req.body.entry?.[0];
  const change = entry?.changes?.[0];
  const message = change?.value?.messages?.[0];

  if (message?.type === "text") {
    const from = message.from;
    const text = message.text.body;

    if (from === OWNER_NUMBER) {
      await handleOwnerCommand(text);
    } else {
      await handleMessage(from, text);
    }
  }

  res.sendStatus(200);
});

// Verify webhook
app.get("/webhook", (req, res) => {
  if (req.query["hub.verify_token"] === "YOUR_VERIFY_TOKEN") {
    res.send(req.query["hub.challenge"]);
  }
});

app.listen(3000, () => console.log("Bot running on port 3000"));
