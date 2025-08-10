// Node 20+ (전역 fetch 사용)
import fs from "node:fs/promises";
import path from "node:path";

const OUT_DIR = path.resolve("public");
const ROUNDS_DIR = path.join(OUT_DIR, "rounds");
const INDEX_PATH = path.join(OUT_DIR, "index.json");
const HIST_PATH  = path.join(OUT_DIR, "history.json");
const SLEEP_MS = Number(process.env.SLEEP_MS || 300); // 연속 호출 완화

async function ensureDirs() { await fs.mkdir(ROUNDS_DIR, { recursive: true }); }
async function sleep(ms){ return new Promise(r=>setTimeout(r, ms)); }

async function fetchRound(n) {
  const url = `https://www.dhlottery.co.kr/common.do?method=getLottoNumber&drwNo=${n}`;
  const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 GH-Actions" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const j = await res.json();
  if (j?.returnValue !== "success") return null; // 아직 공개 전
  const numbers = [j.drwtNo1, j.drwtNo2, j.drwtNo3, j.drwtNo4, j.drwtNo5, j.drwtNo6];
  return { round: j.drwNo, drawDate: j.drwNoDate, numbers, bonus: j.bnusNo, updatedAt: new Date().toISOString() };
}

async function readJsonSafe(p, fallback){ try { return JSON.parse(await fs.readFile(p,"utf8")); } catch { return fallback; } }
async function writeRoundFile(data){ await fs.writeFile(path.join(ROUNDS_DIR, `${data.round}.json`), JSON.stringify(data, null, 2)); }
async function updateIndex(latestRound){ await fs.writeFile(INDEX_PATH, JSON.stringify({ latestRound, updatedAt: new Date().toISOString() }, null, 2)); }
async function updateHistory(data){
  const hist = await readJsonSafe(HIST_PATH, []);
  if (!hist.some(x=>x.round===data.round)){ hist.push(data); hist.sort((a,b)=>a.round-b.round); await fs.writeFile(HIST_PATH, JSON.stringify(hist, null, 2)); }
}

async function detectStartRound(){
  const files = await fs.readdir(ROUNDS_DIR).catch(()=>[]);
  const nums = files.map(f=>Number(f.replace(".json",""))).filter(Number.isInteger);
  const max = nums.length ? Math.max(...nums) : 0;
  return Math.max(1, max+1);
}

async function discoverLatest(startGuess=1200){
  let n=startGuess, lastOk=0, misses=0;
  while(misses<3){
    const data = await fetchRound(n);
    if (data){ lastOk=n; n++; misses=0; } else { misses++; n++; }
    await sleep(SLEEP_MS);
  }
  return lastOk;
}

(async ()=>{
  await ensureDirs();
  const start = await detectStartRound();
  const latest = await discoverLatest(Math.max(start, 1200));
  console.log(`backfill ${start}..${latest}`);
  for (let n=start; n<=latest; n++){
    const data = await fetchRound(n);
    if (!data){ console.log(`round ${n} not ready, stop.`); break; }
    await writeRoundFile(data);
    await updateIndex(data.round);
    await updateHistory(data);
    console.log(`saved round ${data.round}`);
    await sleep(SLEEP_MS);
  }
  console.log("backfill done.");
})();
