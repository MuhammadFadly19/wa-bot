import pkg from "whatsapp-web.js";
const { Client, LocalAuth, MessageMedia } = pkg;
import qrcode from "qrcode-terminal";
import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import ytdlp from "yt-dlp-exec";
import ytdl from "ytdl-core";
import { createCanvas } from "canvas";

// API keys kamu
const YT_API = "AIzaSyDD0OfUzCOjVyC_jP1AmY_7fC7XzYcR5sg";
const WEATHER_API = "5e9a21afae6892e170bc16ff59be2f2a";
const NEWS_API = "973812b6a2da484182d902366ad5b61d";

const __dirname = path.resolve();

// === Folder media ===
const mediaDir = path.join(__dirname, "media");
const ytDir = path.join(mediaDir, "yt");
const imgDir = path.join(mediaDir, "gambar");
const stkDir = path.join(mediaDir, "stiker");
[mediaDir, ytDir, imgDir, stkDir].forEach((f) => {
  if (!fs.existsSync(f)) fs.mkdirSync(f, { recursive: true });
});

// === Helper reply aman ===
async function safeReply(msg, teks) {
  try {
    await msg.reply(teks);
  } catch (e) {
    console.error("Reply error:", e.message);
  }
}

// === Random file picker ===
function pickRandomFile(folder) {
  if (!fs.existsSync(folder)) return null;
  const files = fs.readdirSync(folder).filter((f) => fs.statSync(path.join(folder, f)).isFile());
  if (!files.length) return null;
  return path.join(folder, files[Math.floor(Math.random() * files.length)]);
}

// === YouTube Downloader ===
async function ytDownloadAudio(videoUrl, outDir) {
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outTemplate = path.join(outDir, "%(title)s.%(ext)s");

  try {
    await ytdlp(videoUrl, {
      extractAudio: true,
      audioFormat: "mp3",
      output: outTemplate,
    });

    const files = fs
      .readdirSync(outDir)
      .filter((f) => f.toLowerCase().endsWith(".mp3"))
      .map((f) => ({ f, t: fs.statSync(path.join(outDir, f)).mtime.getTime() }))
      .sort((a, b) => b.t - a.t);

    if (files.length) return path.join(outDir, files[0].f);
  } catch (err) {
    console.warn("⚠️ yt-dlp gagal:", err.message);
  }

  try {
    const info = await ytdl.getInfo(videoUrl);
    const title = info.videoDetails.title.replace(/[\\/:*?"<>|]/g, "").slice(0, 50);
    const outFile = path.join(outDir, `${title}.mp3`);

    const stream = ytdl(videoUrl, { filter: "audioonly", quality: "highestaudio" });
    await new Promise((resolve, reject) => {
      const fileStream = fs.createWriteStream(outFile);
      stream.pipe(fileStream);
      stream.on("end", resolve);
      stream.on("error", reject);
    });

    return outFile;
  } catch (err2) {
    console.error("❌ ytdl-core gagal:", err2.message);
    return null;
  }
}

// === Client ===
const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: { headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] },
});

client.on("qr", (qr) => qrcode.generate(qr, { small: true }));
client.on("ready", () => console.log("✅ Bot siap!"));

// === Handler Pesan ===
client.on("message", async (msg) => {
  const text = msg.body.toLowerCase();
  const textRaw = msg.body.trim();
  const chat = await msg.getChat();
  const chatId = msg.from;

  // ========== Menu ==========
  if (text === "menu") {
    return safeReply(
      msg,
      `✨ *Menu Bot WhatsApp* ✨\n\n` +
        `📌 *Umum*\n` +
        `- menu → Lihat daftar fitur\n` +
        `- gambar → Kirim gambar random\n` +
        `- stiker → Kirim stiker random\n` +
        `- stiker <teks> → Bikin stiker dari teks\n` +
        `- (kirim gambar + ketik "stiker") → Convert gambar jadi stiker\n\n` +
        `🌍 *Informasi*\n` +
        `- wikipedia <kata> → Cari di Wikipedia\n` +
        `- cuaca <kota> → Info cuaca\n` +
        `- news <keyword> → Cari berita terbaru\n\n` +
        `🎵 *YouTube*\n` +
        `- youtube <link/judul> → Download audio\n` +
        `- ytjudul <judul> → Cari link video YouTube\n\n` +
        `🎮 *Game*\n` +
        `- tebak angka → Main tebak angka (1-10)\n` +
        `- suit <batu/kertas/gunting> → Main suit lawan bot`
    );
  }

  // ========== Stiker dari teks ==========
  if (text.startsWith("stiker ")) {
    const teks = textRaw.slice(7).trim();
    if (!teks) return safeReply(msg, "⚠️ Masukkan teks untuk dijadikan stiker.");

    const canvas = createCanvas(512, 512);
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, 512, 512);
    ctx.fillStyle = "#000";
    ctx.font = "bold 40px Sans";
    ctx.textAlign = "center";
    ctx.fillText(teks, 256, 256);

    const buffer = canvas.toBuffer("image/png");
    const outFile = path.join(stkDir, `stiker-${Date.now()}.png`);
    fs.writeFileSync(outFile, buffer);

    const media = MessageMedia.fromFilePath(outFile);
    return client.sendMessage(chatId, media, { sendMediaAsSticker: true });
  }

  // ========== Stiker dari gambar ==========
  if (text === "stiker" && msg.hasMedia) {
    const media = await msg.downloadMedia();
    if (!media) return safeReply(msg, "❌ Gagal download gambar.");

    const outFile = path.join(stkDir, `stiker-${Date.now()}.png`);
    fs.writeFileSync(outFile, Buffer.from(media.data, "base64"));

    const stickerMedia = MessageMedia.fromFilePath(outFile);
    return client.sendMessage(chatId, stickerMedia, { sendMediaAsSticker: true });
  }

  // ========== Game: Tebak Angka ==========
  if (text === "tebak angka") {
    const angka = Math.floor(Math.random() * 10) + 1;
    return safeReply(msg, `🎲 Aku sudah pilih angka 1-10.\nCoba tebak! Angkanya: *${angka}* 😁`);
  }

  // ========== Game: Suit ==========
  if (text.startsWith("suit ")) {
    const pilihan = textRaw.slice(5).trim().toLowerCase();
    const opsi = ["batu", "kertas", "gunting"];
    if (!opsi.includes(pilihan)) return safeReply(msg, "⚠️ Pilih: batu, kertas, atau gunting.");

    const botPilihan = opsi[Math.floor(Math.random() * opsi.length)];
    let hasil = "Seri!";
    if (
      (pilihan === "batu" && botPilihan === "gunting") ||
      (pilihan === "kertas" && botPilihan === "batu") ||
      (pilihan === "gunting" && botPilihan === "kertas")
    ) {
      hasil = "Kamu menang 🎉";
    } else if (pilihan !== botPilihan) {
      hasil = "Bot menang 😜";
    }
    return safeReply(msg, `🪨✂️📄 Suit!\nKamu: *${pilihan}*\nBot: *${botPilihan}*\n\nHasil: *${hasil}*`);
  }

  // ========== Wikipedia ==========
  if (text.startsWith("wikipedia ")) {
    const q = textRaw.slice(10).trim();
    if (!q) return safeReply(msg, "⚠️ Masukkan kata yang mau dicari.");
    try {
      const r = await fetch(`https://id.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(q)}`);
      const d = await r.json();
      if (d.extract) return safeReply(msg, `📖 *${d.title}*\n\n${d.extract}`);
      else return safeReply(msg, "❌ Tidak ditemukan di Wikipedia.");
    } catch {
      return safeReply(msg, "❌ Gagal akses Wikipedia.");
    }
  }

  // ========== Cuaca ==========
  if (text.startsWith("cuaca ")) {
    const kota = textRaw.slice(6).trim();
    if (!kota) return safeReply(msg, "⚠️ Masukkan nama kota.");
    try {
      const r = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(
          kota
        )}&appid=${WEATHER_API}&units=metric&lang=id`
      );
      const d = await r.json();
      if (d.cod !== 200) return safeReply(msg, "❌ Kota tidak ditemukan.");
      return safeReply(
        msg,
        `🌤️ *Cuaca ${d.name}*\nSuhu: ${d.main.temp}°C\nKelembapan: ${d.main.humidity}%\n${d.weather[0].description}`
      );
    } catch {
      return safeReply(msg, "❌ Gagal ambil data cuaca.");
    }
  }

  // ========== News ==========
  if (text.startsWith("news ")) {
    const q = textRaw.slice(5).trim();
    if (!q) return safeReply(msg, "⚠️ Masukkan kata kunci berita.");
    try {
      const r = await fetch(
        `https://newsapi.org/v2/everything?q=${encodeURIComponent(q)}&apiKey=${NEWS_API}&pageSize=3&language=id`
      );
      const d = await r.json();
      if (!d.articles?.length) return safeReply(msg, "❌ Tidak ada berita.");
      let out = `📰 *Berita tentang ${q}*:\n\n`;
      d.articles.forEach((a, i) => {
        out += `${i + 1}. *${a.title}*\n${a.url}\n\n`;
      });
      return safeReply(msg, out);
    } catch {
      return safeReply(msg, "❌ Gagal ambil berita.");
    }
  }

  // ========== YouTube (Download) ==========
  if (text.startsWith("youtube ")) {
    let q = textRaw.slice(8).trim();
    if (!q) return safeReply(msg, "⚠️ Masukkan link atau judul.");
    let url = q;

    if (!/^https?:\/\//.test(q)) {
      try {
        const rr = await fetch(
          `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&q=${encodeURIComponent(q)}&key=${YT_API}&maxResults=1`
        );
        const dd = await rr.json();
        const item = dd.items?.[0];
        if (!item) return safeReply(msg, "❌ Video tidak ditemukan.");
        url = `https://www.youtube.com/watch?v=${item.id.videoId}`;
      } catch {
        return safeReply(msg, "❌ Gagal mencari video di YouTube.");
      }
    }

    await safeReply(msg, "⏳ Sedang download audio...");
    const out = await ytDownloadAudio(url, ytDir);
    if (!out) return safeReply(msg, "❌ Gagal membuat file audio.");

    const m = MessageMedia.fromFilePath(out);
    await client.sendMessage(chatId, m, { caption: "🎵 Selesai!" });
  }

  // ========== YouTube (Cari Link) ==========
  if (text.startsWith("ytjudul ")) {
    const q = textRaw.slice(8).trim();
    if (!q) return safeReply(msg, "⚠️ Masukkan judul video.");
    try {
      const rr = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&q=${encodeURIComponent(q)}&key=${YT_API}&maxResults=3`
      );
      const dd = await rr.json();
      if (!dd.items?.length) return safeReply(msg, "❌ Tidak ada hasil.");
      let out = `🎬 *Hasil pencarian YouTube: ${q}*\n\n`;
      dd.items.forEach((v, i) => {
        out += `${i + 1}. ${v.snippet.title}\nhttps://www.youtube.com/watch?v=${v.id.videoId}\n\n`;
      });
      return safeReply(msg, out);
    } catch {
      return safeReply(msg, "❌ Gagal mencari video di YouTube.");
    }
  }
});

client.initialize();
