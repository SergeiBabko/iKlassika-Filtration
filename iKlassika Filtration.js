class IKlassikaFiltration {
  // User preferences
  iosVersion = 8;
  fetchDownloadLinks = true;


  // Main logic
  originalApps = [];
  filteredApps = [];
  iKlassikaUrl = 'https://iklassika.ru/';
  iKlassikaFavicon = 'https://iklassika.ru/img/favicon/favicon-32x32.png';

  start = 0;
  end = 0;

  async initialize() {
    this.start = performance.now();
    this.getAllApps();
    await this.filterAndSortApps();
    this.openPage();
    this.end = performance.now();
    this.logResult();
  }

  toTitleCase(str) {
    const exclusions = new Set([
      'a', 'an', 'the',
      'and', 'but', 'or', 'nor', 'for', 'so', 'yet',
      'at', 'by', 'for', 'in', 'of', 'off', 'on', 'per', 'to', 'up', 'via', 'with',
      'as', 'than', 'that', 'if', 'when', 'from', 'over', 'into', 'onto'
    ]);

    const words = str.split(/\s+/);
    const result = words.map((word, index) => {
      if (
        index === 0 ||
        index === words.length - 1 ||
        !exclusions.has(word)
      ) {
        return word[0].toUpperCase() + word.slice(1);
      }
      return word;
    });

    return result.join(' ');
  }

  async preloadAndExtract(url) {
    let downloadUrl;
    let screenshotsUrls = [];
    try {
      const res = await fetch(url);
      const html = await res.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const button = doc.querySelector('.app-download a.button');
      const screenshots = doc.querySelectorAll('.app-screenshot img');
      if (button) {
        const buttonUrl = button.getAttribute('href');
        downloadUrl = buttonUrl?.replace('download.php?file=', '');
      }
      if (screenshots.length > 0) {
        screenshots.forEach(img => {
          if (img.src) {
            screenshotsUrls.push(img.src);
          }
        });
      }
      return { downloadUrl, screenshotsUrls };
    } catch (err) {
      return {};
    }
  }

  getAllApps() {
    const elements = document.querySelectorAll('.app-list');
    elements.forEach((el) => {
      try {
        const linkElement = el.querySelector('a[href^="app.php?id="]');
        if (!linkElement) return;

        const appUrl = this.iKlassikaUrl + linkElement.getAttribute('href');

        const id = new URLSearchParams(new URL(appUrl).search).get('id');

        const imgElement = el.querySelector('.app-list-icon img');
        const image = imgElement ? (this.iKlassikaUrl + imgElement.getAttribute('src')).trim() : '';

        const nameElement = el.querySelector('a.app-list-title.list-page');
        const name = nameElement ? this.toTitleCase(nameElement.textContent) : 'N/A';

        // There are two p.app-list-version elements - one for version and one for iOS version
        // Let's get both
        const versionElements = el.querySelectorAll('p.app-list-version');
        let version = 'N/A';
        let iosVersion = 'N/A';

        versionElements.forEach((ve) => {
          const text = ve.textContent.trim();
          if (text.startsWith('Версия:')) {
            version = text.replace('Версия:', '').trim() || version;
          } else if (text.startsWith('iOS:')) {
            iosVersion = text.replace('iOS:', '').trim() || iosVersion;
          }
        });

        this.originalApps.push({ id, name, image, version, iosVersion, appUrl });
      } catch {
        // skip any malformed entries
      }
    });
  }

  async filterAndSortApps() {
    // Helper to parse version strings like "8.0.3" into arrays of numbers [8,0,3]
    function parseVersion(version) {
      return version.split('.').map(Number);
    }

    // Compare two versions, return 1 if v1 > v2, -1 if v1 < v2, 0 if equal
    function compareVersions(v1, v2) {
      const a = parseVersion(v1);
      const b = parseVersion(v2);
      for (let i = 0; i < Math.max(a.length, b.length); i++) {
        const num1 = a[i] || 0;
        const num2 = b[i] || 0;
        if (num1 > num2) return 1;
        if (num1 < num2) return -1;
      }
      return 0;
    }

    // Filter to iosVersion <= 9.x.x (means major version = 9)
    const filtered = this.originalApps.filter(app => {
      const iosMajor = Number(app.iosVersion.split('.')[0]);
      return iosMajor <= this.iosVersion;
    });

    // Keep only the latest version per app name
    const latestVersions = {};
    filtered.forEach(app => {
      const appName = app.name.toLowerCase();
      if (!latestVersions[appName] || compareVersions(app.version, latestVersions[appName].version) > 0) {
        latestVersions[appName] = app;
      }
    });

    // Convert object back to array and sort by name
    this.filteredApps = Object.values(latestVersions).sort((a, b) => a.name.localeCompare(b.name));

    if (this.fetchDownloadLinks) {
      for (const app of this.filteredApps) {
        const { downloadUrl, screenshotsUrls } = await this.preloadAndExtract(app.appUrl);
        app.downloadUrl = downloadUrl;
        app.screenshotsUrls = screenshotsUrls;
      }
    }
  }

  openPage() {
    const currentURL = location.href;

    function getDownloadUrlButton(downloadUrl) {
      if (!downloadUrl) return '';
      return `<a class="download-btn" href="${downloadUrl}" target="_blank" rel="noopener noreferrer">Download</a>`;
    }

    const appItemsHTML = this.filteredApps.map(app => `
    <div class="app" id="${app.id}">
      <img class="app-img-bg" src="${app.screenshotsUrls[0] || app.image}" alt="">
      <img class="app-img" src="${app.image}" alt="${app.name}" onclick="openModal('${app.screenshotsUrls}')">
      <div class="app-details">
        <h2 title="${app.name}">${app.name}</h2>
        <p>Version: ${app.version}</p>
        <p>iOS Version: ${app.iosVersion}</p>
        <div class="buttons">
          ${getDownloadUrlButton(app.downloadUrl)}
          <a class="site-btn" href="${app.appUrl}" target="_blank" rel="noopener noreferrer"><img src="${this.iKlassikaFavicon}" alt=""></a>
        </div>
      </div>
    </div>
  `).join('');

    const fullHTML = `
    <html lang="en">
    <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="icon" type="image/png" sizes="32x32" href="${this.iKlassikaFavicon}">
    <title>Filtered iOS${this.iosVersion}.x.x Apps from iKlassika</title>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=SF+Pro+Display:wght@400;600&display=swap');

      body {
        display: flex;
        color: #1c1c1e;
        margin: 0 auto;
        max-width: 1100px;
        background: #e5e5ea;
        flex-direction: column;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif;
      }

      body * {
        box-sizing: border-box;
      }

      a {
        color: unset;
        text-decoration: unset;
      }

      h1 {
        font-weight: 600;
        font-size: 2.5rem;
        text-align: center;
      }

      #apps-container {
        gap: 30px;
        display: grid;
        padding: 10px 30px 30px;
        grid-template-columns: 1fr 1fr;
      }

      .app {
        gap: 20px;
        padding: 20px;
        display: flex;
        overflow: hidden;
        position: relative;
        background: #ffffff;
        align-items: center;
        border-radius: 40px;
        transition: box-shadow 0.3s ease;
        box-shadow: 0 10px 30px rgb(0 0 0 / 0.1);
      }

      .app * {
        z-index: 1;
      }

      .app:hover {
        box-shadow: 0 15px 40px rgb(0 0 0 / 0.15);
      }

      .app .app-img {
        height: 140px;
        flex-shrink: 0;
        cursor: pointer;
        object-fit: cover;
        border-radius: 25px;
        box-shadow: 0 4px 8px rgb(0 0 0 / 0.1);
      }

      .app .app-img-bg {
        left: 0;
        right: 0;
        z-index: 0;
        width: 100%;
        opacity: 0.1;
        position: absolute;
        pointer-events: none;
        filter: blur(10px) contrast(0.7);
      }

      .app-details {
        width: 100%;
        height: 100%;
        display: flex;
        overflow: hidden;
        flex-direction: column;
        justify-content: space-around;
      }

      .app-details h2 {
        margin: 0;
        color: #000;
        overflow: hidden;
        font-weight: 600;
        font-size: 1.4rem;
        white-space: nowrap;
        text-overflow: ellipsis;
      }

      .app-details p {
        margin: 0;
        font-size: 1rem;
        color: #3c3c4399;
        font-weight: 400;
      }

      .app-details .buttons {
        gap: 12px;
        display: flex;
      }

      .app-details .buttons a img {
        width: 16px;
        height: 16px;
        border-radius: 4px;
      }

      .app-details .buttons a {
        height: 38px;
        display: flex;
        font-weight: 600;
        align-items: center;
        border-radius: 12px;
        text-decoration: none;
        justify-content: center;
        border: 2px solid transparent;
        background-color: transparent;
        transition: border, color, background-color 0.3s ease, color 0.3s ease;
      }

      .app-details .buttons .download-btn {
        color: #50c753;
        padding: 0 12px;
        border-color: #50c753;
      }

      .app-details .buttons .download-btn:hover {
        color: white;
        background-color: #50c753;
      }

      .app-details .buttons .site-btn {
        color: #4593fe;
        aspect-ratio: 1 / 1;
        border-color: #4593fe;
      }

      .app-details .buttons .site-btn:hover {
        color: white;
        background-color: #4593fe;
      }

      #modal {
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        width: 100%;
        height: 100%;
        z-index: 100;
        display: none;
        position: fixed;
        overflow: hidden;
        align-items: center;
        pointer-events: none;
        justify-content: center;
      }

      #modal.show {
        display: flex;
        pointer-events: auto;
        backdrop-filter: blur(10px);
        background-color: rgba(0 0 0 / 70%);
      }

      #modal #modal-content {
        gap: 30px;
        width: 100%;
        height: 100%;
        padding: 30px;
        display: grid;
        overflow: auto;
        align-items: center;
        justify-content: center;
        grid-template-columns: repeat(auto-fit, minmax(200px, 600px));
      }

      #modal #modal-content img {
        width: 100%;
        border-radius: 25px;
        box-shadow: 0 10px 30px rgb(0 0 0 / 0.1);
      }

      #modal #modal-content img:hover {
        box-shadow: 0 15px 40px rgb(0 0 0 / 0.15);
      }

      @media (max-width: 800px) {
        .app {
          flex-direction: column;
        }
        .app-details {
        gap: 8px;
          align-items: center;
        }
        .app-details h2 {
          width: 100%;
            text-align: center;
        }
      }
    </style>
    </head>
    <body>
      <h1><a href="${currentURL}" target="_blank" rel="noopener noreferrer">Filtered iOS${this.iosVersion}.x.x Apps from iKlassika</a></h1>
      <div id="apps-container">
        ${appItemsHTML}
      </div>
      <div id="modal" onclick="closeOnOutsideClick(event)">
        <div id="modal-content"></div>
      </div>
      <script>
        function openModal(screenshotsUrlsString) {
          const screenshotsUrls = screenshotsUrlsString.split(',');

          const modal = document.getElementById('modal');
          const content = document.getElementById('modal-content');
          content.innerHTML = '';

          screenshotsUrls.forEach((url, idx) => {
            const img = document.createElement('img');
            img.src = url;
            img.alt = 'Screenshot-' + (idx + 1);
            content.appendChild(img);
          });

          modal.classList.add('show');
          document.body.style.overflow = 'hidden';
        }

        function closeOnOutsideClick(event) {
          if (event.target.localName === 'img') return;
          const modal = document.getElementById('modal');
          const content = document.getElementById('modal-content');
          document.body.style.overflow = 'auto';
          modal.classList.remove('show');
          content.innerHTML = '';
       }

        document.addEventListener('keydown', function(e) {
          if (e.key === 'Escape') {
            document.getElementById('modal').classList.remove('show');
          }
        });   
      </script>
    </body>
    </html>`;

    const newWindow = window.open();
    if (!newWindow) {
      alert('Popup blocked. Please allow popups for this site.');
      return;
    }

    newWindow.document.open();
    newWindow.document.write(fullHTML);
    newWindow.document.close();
  }

  logResult() {
    console.clear();
    console.log(`Execution time: ${(this.end - this.start) / 1000}s`);
    console.log('Original Apps: ', this.originalApps);
    console.log('Filtered Apps: ', this.filteredApps);
  }
}

await new IKlassikaFiltration().initialize();
