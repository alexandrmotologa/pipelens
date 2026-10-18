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
  await new Promise(r => setTimeout(r, 1200));

  // 1. Profiler Tab (Gantt Waterfall)
  console.log('Capturing pipelens_profiler.png...');
  await page.screenshot({ path: path.join(imagesDir, 'pipelens_profiler.png') });
  await page.screenshot({ path: path.join(framesDir, 'frame_01.png') });

  // Get tab buttons:
  // Tab 0: Profile Run button (in header)
  // Tab 1: Gantt Waterfall
  // Tab 2: Critical Path DAG
  // Tab 3: Run Diff & Regressions
  // Tab 4: Security & Supply-Chain Linter
  // Tab 5: Matrix Simulator & Expressions
  const tabButtons = await page.$$('header div.flex.space-x-1 button, header div.flex.space-x-4 button, header button');
  console.log(`Found ${tabButtons.length} header buttons.`);

  // Click by button text to be 100% resilient
  const clickTabByText = async (textSnippet: string) => {
    const buttons = await page.$$('button');
    for (const btn of buttons) {
      const text = await page.evaluate(el => el.textContent || '', btn);
      if (text.includes(textSnippet)) {
        await btn.click();
        await new Promise(r => setTimeout(r, 800));
        return true;
      }
    }
    return false;
  };

  // 2. DAG Visualizer Tab
  console.log('Capturing pipelens_dag.png...');
  await clickTabByText('Critical Path DAG');
  await page.screenshot({ path: path.join(imagesDir, 'pipelens_dag.png') });
  await page.screenshot({ path: path.join(framesDir, 'frame_02.png') });

  // 3. Run Diff & Regressions Tab
  console.log('Capturing pipelens_regression.png...');
  await clickTabByText('Run Diff');
  await page.screenshot({ path: path.join(imagesDir, 'pipelens_regression.png') });
  await page.screenshot({ path: path.join(framesDir, 'frame_03.png') });

  // 4. Security Linter Tab
  console.log('Capturing pipelens_linter.png...');
  await clickTabByText('Security & Supply-Chain');
  await page.screenshot({ path: path.join(imagesDir, 'pipelens_linter.png') });
  await page.screenshot({ path: path.join(framesDir, 'frame_04.png') });

  // 5. Open Diff modal
  console.log('Capturing pipelens_diff.png (Safe Auto-Fix Diff)...');
  const fixClicked = await clickTabByText('1-Click Auto Fix & Diff');
  if (fixClicked) {
    await new Promise(r => setTimeout(r, 800));
    await page.screenshot({ path: path.join(imagesDir, 'pipelens_diff.png') });
    await page.screenshot({ path: path.join(framesDir, 'frame_05.png') });

    // Close modal
    await clickTabByText('Close');
    await new Promise(r => setTimeout(r, 400));
  }

  // 6. Matrix Simulator Tab
  console.log('Capturing pipelens_matrix.png...');
  await clickTabByText('Matrix Simulator');
  await page.screenshot({ path: path.join(imagesDir, 'pipelens_matrix.png') });
  await page.screenshot({ path: path.join(framesDir, 'frame_06.png') });

  // 7. Capture Mobile Viewport (iPhone 14 / 390x844) to verify responsiveness
  console.log('Capturing mobile responsive view...');
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  await clickTabByText('Gantt Waterfall');
  await page.screenshot({ path: path.join(imagesDir, 'pipelens_mobile.png') });

  await browser.close();
  console.log('Visual assets captured successfully.');

  // Create animated demo GIF via ffmpeg
  const gifPath = path.join(imagesDir, 'pipelens_demo.gif');
  console.log(`Generating animated demo GIF: ${gifPath}...`);
  try {
    const ffmpegCmd = `ffmpeg -y -framerate 1.0 -i "${path.join(framesDir, 'frame_%02d.png')}" -vf "scale=1200:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128:reserve_transparent=0[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3" "${gifPath}"`;
    execSync(ffmpegCmd, { stdio: 'inherit' });
    console.log('Demo GIF created successfully!');
  } catch (err: any) {
    console.error('Error creating GIF with ffmpeg:', err.message);
  }

  // Clean up frames directory
  fs.rmSync(framesDir, { recursive: true, force: true });

  // Copy genuine execution assets to mtlg-site and mtlglabs-space
  // Note: Obeying Universal Invariant: NEVER copy logo to portfolio screenshot folders!
  const siteImagesDir = path.resolve('B:/workgit/mtlg-site/images');
  const labsImagesDir = path.resolve('B:/workgit/mtlglabs-space/images');

  const assetsToCopy = [
    'pipelens_profiler.png',
    'pipelens_dag.png',
    'pipelens_regression.png',
    'pipelens_linter.png',
    'pipelens_diff.png',
    'pipelens_matrix.png',
    'pipelens_mobile.png',
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
