import puppeteer from 'puppeteer';
import path from 'node:path';
import fs from 'node:fs';
import { execSync } from 'node:child_process';

async function main() {
  const imagesDir = path.resolve(process.cwd(), 'docs', 'images');
  if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
  }

  const framesDir = path.resolve(imagesDir, 'frames');
  if (!fs.existsSync(framesDir)) {
    fs.mkdirSync(framesDir, { recursive: true });
  }

  console.log('Launching browser to capture visual assets...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });

  await page.goto('http://localhost:3840/', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 1000));

  // 1. Profiler Tab (Gantt Waterfall)
  console.log('Capturing pipelens_profiler.png...');
  await page.screenshot({ path: path.join(imagesDir, 'pipelens_profiler.png') });
  await page.screenshot({ path: path.join(framesDir, 'frame_01.png') });

  // 2. DAG Visualizer Tab
  console.log('Capturing pipelens_dag.png...');
  const tabs = await page.$$('header button');
  if (tabs.length >= 4) {
    // Click DAG tab (index 2)
    await tabs[2].click();
    await new Promise(r => setTimeout(r, 800));
    await page.screenshot({ path: path.join(imagesDir, 'pipelens_dag.png') });
    await page.screenshot({ path: path.join(framesDir, 'frame_02.png') });

    // 3. Security Linter Tab
    console.log('Capturing pipelens_linter.png...');
    await tabs[3].click();
    await new Promise(r => setTimeout(r, 800));
    await page.screenshot({ path: path.join(imagesDir, 'pipelens_linter.png') });
    await page.screenshot({ path: path.join(framesDir, 'frame_03.png') });

    // Open Diff modal
    const fixButton = await page.$('button ::-p-text(1-Click Auto Fix & Diff)');
    if (fixButton) {
      await fixButton.click();
      await new Promise(r => setTimeout(r, 800));
      await page.screenshot({ path: path.join(imagesDir, 'pipelens_diff.png') });
      await page.screenshot({ path: path.join(framesDir, 'frame_04.png') });

      // Close modal
      const closeButton = await page.$('button ::-p-text(Close)');
      if (closeButton) {
        await closeButton.click();
        await new Promise(r => setTimeout(r, 500));
      }
    }

    // 4. Matrix Simulator Tab
    console.log('Capturing pipelens_matrix.png...');
    await tabs[4].click();
    await new Promise(r => setTimeout(r, 800));
    await page.screenshot({ path: path.join(imagesDir, 'pipelens_matrix.png') });
    await page.screenshot({ path: path.join(framesDir, 'frame_05.png') });
  }

  await browser.close();
  console.log('Visual assets captured successfully.');

  // Create animated demo GIF via ffmpeg
  const gifPath = path.join(imagesDir, 'pipelens_demo.gif');
  console.log(`Generating animated demo GIF: ${gifPath}...`);
  try {
    // 0.8 seconds per frame with smooth palette
    const ffmpegCmd = `ffmpeg -y -framerate 1.2 -i "${path.join(framesDir, 'frame_%02d.png')}" -vf "scale=1200:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128:reserve_transparent=0[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3" "${gifPath}"`;
    execSync(ffmpegCmd, { stdio: 'inherit' });
    console.log('Demo GIF created successfully!');
  } catch (err: any) {
    console.error('Error creating GIF with ffmpeg:', err.message);
  }

  // Clean up frames directory
  fs.rmSync(framesDir, { recursive: true, force: true });

  // Copy assets to mtlg-site and mtlglabs-space
  const siteImagesDir = path.resolve('B:/workgit/mtlg-site/images');
  const labsImagesDir = path.resolve('B:/workgit/mtlglabs-space/images');

  const assetsToCopy = [
    'pipelens_profiler.png',
    'pipelens_dag.png',
    'pipelens_linter.png',
    'pipelens_diff.png',
    'pipelens_matrix.png',
    'pipelens_demo.gif',
  ];

  for (const asset of assetsToCopy) {
    const src = path.join(imagesDir, asset);
    if (fs.existsSync(src)) {
      if (fs.existsSync(siteImagesDir)) {
        fs.copyFileSync(src, path.join(siteImagesDir, asset));
      }
      if (fs.existsSync(labsImagesDir)) {
        fs.copyFileSync(src, path.join(labsImagesDir, asset));
      }
      console.log(`Synced ${asset} to portfolio sites.`);
    }
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
