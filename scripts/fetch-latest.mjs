import fs from "node:fs/promises";
import path from "node:path";

const OUT_DIR = path.resolve("public");
const ROUNDS_DIR = path.join(OUT_DIR, "rounds");
const INDEX_PATH = path.join(OUT_DIR, "index.json");
const HIST_PATH  = path.join(OUT_DIR, "history.json");

async function ensureDirs(){ await fs.mkdir(ROUNDS_DIR, { recursive: true }); }
async function readJsonSafe(p, fallback){ try { return JSON.parse(await fs.readFile(p,"utf8")); } catch { return fallback; } }

async function fetchRound(n) {
  const url = `https://www.dhlottery.co.kr/common.do?method=getLottoNumber&drwNo=${n}`;
  const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 GH-Actions" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const j = await res.json();
  if (j?.returnValue !== "success") throw new Error("not ready");
  const numbers = [j.drwtNo1, j.drwtNo2, j.drwtNo3, j.drwtNo4, j.drwtNo5, j.drwtNo6];
  return { round: j.drwNo, drawDate: j.drwNoDate, numbers, bonus: j.bnusNo, updatedAt: new Date().toISOString() };
}

async function getLatestLocal(){ const idx = await readJsonSafe(INDEX_PATH, { latestRound: 0 }); return idx.latestRound || 0; }
async function updateIndexAndHistory(data){
  await fs.writeFile(INDEX_PATH, JSON.stringify({ latestRound: data.round, updatedAt: new Date().toISOString() }, null, 2));
  const hist = await readJsonSafe(HIST_PATH, []);
  if (!hist.some(x=>x.round===data.round)){ hist.push(data); hist.sort((a,b)=>a.round-b.round); await fs.writeFile(HIST_PATH, JSON.stringify(hist, null, 2)); }
}

(async ()=>{
  await ensureDirs();
  const next = (await getLatestLocal()) + 1 || 1;
  try{
    const data = await fetchRound(next);
    await fs.writeFile(path.join(ROUNDS_DIR, `${data.round}.json`), JSON.stringify(data, null, 2));
    await fs.writeFile(path.join(OUT_DIR, "latest.json"), JSON.stringify(data, null, 2));
    await updateIndexAndHistory(data);
    console.log(`updated to round ${data.round}`);
  }catch(e){
    console.log(`no update for round ${next}: ${e.message}`);
  }
})();
