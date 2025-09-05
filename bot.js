import pkg from "whatsapp-web.js";
const { Client, LocalAuth, MessageMedia } = pkg;
import qrcode from "qrcode-terminal";
import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import ytdl from "ytdl-core";
import { createCanvas, loadImage } from "canvas";

const __dirname = path.resolve();
const YT_API = "AIzaSyDD0OfUzCOjVyC_jP1AmY_7fC7XzYcR5sg";
const WEATHER_API = "5e9a21afae6892e170bc16ff59be2f2a";
const NEWS_API = "973812b6a2da484182d902366ad5b61d";

// Folder media
const mediaDir = path.join(__dirname, "media");
const ytDir = path.join(mediaDir, "yt");
const imgDir = path.join(mediaDir, "gambar");
const stkDir = path.join(mediaDir, "stiker");
[mediaDir, ytDir, imgDir, stkDir].forEach(f => { if (!fs.existsSync(f)) fs.mkdirSync(f, { recursive: true }); });

// Helper reply aman
async function safeReply(msg, teks) {
  try { await msg.reply(teks); } catch (e) { console.error("Reply error:", e.message); }
}

// Random file picker
function pickRandomFile(folder) {
  if (!fs.existsSync(folder)) return null;
  const files = fs.readdirSync(folder).filter(f => fs.statSync(path.join(folder,f)).isFile());
  if (!files.length) return null;
  return path.join(folder, files[Math.floor(Math.random()*files.length)]);
}

// YouTube download audio
async function ytDownloadAudio(videoUrl, outDir) {
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir,{recursive:true});
  const info = await ytdl.getInfo(videoUrl);
  const title = info.videoDetails.title.replace(/[\\/:*?"<>|]/g,"").slice(0,50);
  const outFile = path.join(outDir, `${title}.mp3`);
  const stream = ytdl(videoUrl, { filter: "audioonly", quality: "highestaudio" });
  await new Promise((resolve,reject) => {
    const fileStream = fs.createWriteStream(outFile);
    stream.pipe(fileStream);
    stream.on("end", resolve);
    stream.on("error", reject);
  });
  return outFile;
}

// Stiker dari teks
async function textToSticker(text, outDir) {
  const canvas = createCanvas(512, 512);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0,0,512,512);
  ctx.fillStyle = "#000000";
  ctx.font = "bold 40px Sans";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 256, 256);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir,{recursive:true});
  const outFile = path.join(outDir, `sticker-${Date.now()}.png`);
  fs.writeFileSync(outFile, canvas.toBuffer("image/png"));
  return outFile;
}

// Client
const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    executablePath: "/data/data/com.termux/files/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox","--disable-setuid-sandbox"]
  }
});

client.on("qr", qr => qrcode.generate(qr,{small:true}));
client.on("ready", () => console.log("✅ Bot siap!"));

client.on("message", async msg => {
  const text = msg.body.toLowerCase();
  const textRaw = msg.body.trim();
  const chatId = msg.from;

  // MENU
  if(text==="menu") return safeReply(msg,
    `📌 *Menu Bot*\n\n` +
    `1. *menu* → Daftar fitur\n` +
    `2. *gambar* → Kirim gambar random\n` +
    `3. *stiker* → Kirim stiker random\n` +
    `4. *stiker <teks>* → Buat stiker dari teks\n` +
    `5. *wikipedia <kata>* → Cari Wikipedia\n` +
    `6. *cuaca <kota>* → Info cuaca\n` +
    `7. *youtube <link/judul>* → Download audio YouTube\n` +
    `8. *news <kata>* → Berita terbaru`
  );

  // GAMBAR
  if(text==="gambar"){
    const file = pickRandomFile(imgDir);
    if(!file) return safeReply(msg,"❌ Tidak ada gambar di folder.");
    const media = MessageMedia.fromFilePath(file);
    return client.sendMessage(chatId,media,{caption:"🖼️ Random Gambar"});
  }

  // STIKER RANDOM
  if(text==="stiker"){
    const file = pickRandomFile(stkDir);
    if(!file) return safeReply(msg,"❌ Tidak ada stiker di folder.");
    const media = MessageMedia.fromFilePath(file);
    return client.sendMessage(chatId,media,{sendMediaAsSticker:true});
  }

  // STIKER DARI TEKS
  if(text.startsWith("stiker ")){
    const teksSticker = textRaw.slice(7).trim();
    if(!teksSticker) return safeReply(msg,"⚠️ Masukkan teks untuk stiker.");
    const outFile = await textToSticker(teksSticker, stkDir);
    const media = MessageMedia.fromFilePath(outFile);
    return client.sendMessage(chatId,media,{sendMediaAsSticker:true});
  }

  // WIKIPEDIA
  if(text.startsWith("wikipedia ")){
    const q = textRaw.slice(10).trim();
    if(!q) return safeReply(msg,"⚠️ Masukkan kata yang mau dicari.");
    try{
      const r = await fetch(`https://id.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(q)}`);
      const d = await r.json();
      if(d.extract) return safeReply(msg,`📖 *${d.title}*\n\n${d.extract}`);
      else return safeReply(msg,"❌ Tidak ditemukan di Wikipedia.");
    }catch(e){ console.error("Wiki error:",e); return safeReply(msg,"❌ Gagal akses Wikipedia."); }
  }

  // CUACA
  if(text.startsWith("cuaca ")){
    const kota = textRaw.slice(6).trim();
    if(!kota) return safeReply(msg,"⚠️ Masukkan nama kota.");
    try{
      const r = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(kota)}&appid=${WEATHER_API}&units=metric&lang=id`);
      const d = await r.json();
      if(d.cod!==200) return safeReply(msg,"❌ Kota tidak ditemukan.");
      const out = `🌤️ *Cuaca ${d.name}*\nSuhu: ${d.main.temp}°C\nKelembapan: ${d.main.humidity}%\n${d.weather[0].description}`;
      return safeReply(msg,out);
    }catch(e){ console.error("Weather error:",e); return safeReply(msg,"❌ Gagal ambil data cuaca."); }
  }

  // YOUTUBE
  if(text.startsWith("youtube ")){
    let q = textRaw.slice(8).trim();
    if(!q) return safeReply(msg,"⚠️ Masukkan link atau judul.");
    let url = q;
    if(!/^https?:\/\//.test(q)){
      try{
        const rr = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&q=${encodeURIComponent(q)}&key=${YT_API}&maxResults=1`);
        const dd = await rr.json();
        const item = dd.items?.[0];
        if(!item) return safeReply(msg,"❌ Video tidak ditemukan.");
        url = `https://www.youtube.com/watch?v=${item.id.videoId}`;
      }catch(e){ console.error("YT search error",e); return safeReply(msg,"❌ Gagal mencari video YouTube."); }
    }
    await safeReply(msg,"⏳ Sedang download audio...");
    const out = await ytDownloadAudio(url,ytDir);
    if(!out) return safeReply(msg,"❌ Gagal membuat file audio.");
    const m = MessageMedia.fromFilePath(out);
    await client.sendMessage(chatId,m,{caption:"🎵 Selesai!"});
  }

  // NEWS
  if(text.startsWith("news ")){
    const q = textRaw.slice(5).trim();
    if(!q) return safeReply(msg,"⚠️ Masukkan kata kunci berita.");
    try{
      const r = await fetch(`https://newsapi.org/v2/everything?q=${encodeURIComponent(q)}&apiKey=${NEWS_API}&pageSize=3&sortBy=publishedAt`);
      const d = await r.json();
      if(d.articles?.length){
        let out = "📰 Berita Terbaru:\n\n";
        d.articles.forEach((a,i) => {
          out += `${i+1}. ${a.title}\n${a.url}\n\n`;
        });
        return safeReply(msg,out);
      } else return safeReply(msg,"❌ Tidak ada berita ditemukan.");
    }catch(e){ console.error("News error:",e); return safeReply(msg,"❌ Gagal ambil berita."); }
  }

});
client.initialize();
