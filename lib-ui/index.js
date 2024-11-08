import {
  convertDocsHtmlToMarkdown,
  defaultOptions,
  combineGoogleDocFormats,
} from '../lib/convert.js';
import { settings as currentSettings } from './settings.js';
import JSZip from 'jszip';

const SLICE_CLIP_MEDIA_TYPE =
  'application/x-vnd.google-docs-document-slice-clip';

const inputElement = document.getElementById('input');
const outputElement = document.getElementById('output');
const inputInstructions = document.querySelector('#input-area .instructions');
const outputInstructions = document.querySelector('#output-area .instructions');

function convert() {
  if (!inputElement || !outputElement) return;

  convertDocsHtmlToMarkdown(
    inputElement.innerHTML,
    null,
    defaultOptions
  )
    .then((markdown) => {
      outputElement.value = markdown;
      if (outputInstructions) {
        outputInstructions.style.display = markdown.trim() ? 'none' : '';
      }
    })
    .catch((error) => {
      console.error(error);
      if (outputInstructions) {
        outputInstructions.style.display = '';
      }
    });
}

function handleInput() {
  if (!inputElement) return;
  
  const hasContent = !!inputElement.textContent;
  if (inputInstructions) {
    inputInstructions.style.display = hasContent ? 'none' : '';
  }
  convert();
}

if (inputElement) {
  inputElement.addEventListener('input', handleInput);
}

// If the clipboard data looks like it came from Google Docs, do some
// pre-processing before inserting it into the input area.
//
// This handles two things:
// 1. Some wrapper structure in the HTML that we want to clean out.
// 2. Pulling relevant data out of the "Slice Clip" format and updating the HTML
//    with it (when available). The clipboard HTML format from Google Docs is
//    missing a lot of detailed info the slice clip has.
inputElement.addEventListener('paste', async (event) => {
  if (!event.clipboardData) {
    console.warn('Could not access clipboard data from paste event');
    return;
  }

  let sliceClip =
    event.clipboardData.getData(SLICE_CLIP_MEDIA_TYPE) ||
    event.clipboardData.getData(`${SLICE_CLIP_MEDIA_TYPE}+wrapped`);

  let html =
    event.clipboardData.getData('text/html') ||
    event.clipboardData.getData('public.html');

  // Both paste types may not always be present. Some browsers (mainly Safari)
  // do not allow cross-origin access to clipboard formats except a select few,
  // and so block access to the slice clip data.
  //
  // More info:
  // - https://webkit.org/blog/10855/async-clipboard-api/
  // - https://webkit.org/blog/8170/clipboard-api-improvements/
  if ((html && sliceClip) || /id=['"']docs-internal-guid-/.test(html)) {
    event.preventDefault();
    const fancyHtml = await combineGoogleDocFormats(html, sliceClip);

    const selection = window.getSelection();
    if (selection.anchorNode && inputElement.contains(selection.anchorNode)) {
      // `execCommand` is discouraged these days, but is the only built-in that
      // does a nice job normalizing the HTML given the input location.
      // (That is, it handles inserting a `<p>` inside a `<p>` or some other
      // incompatible situation gracefully.)
      document.execCommand('insertHTML', false, fancyHtml);
    } else {
      inputElement.innerHTML = fancyHtml;
    }

    handleInput();
  }
});

const copyButton = document.getElementById('copy-button');
if (navigator.clipboard && navigator.clipboard.writeText) {
  copyButton.style.display = '';
  copyButton.addEventListener('click', () => {
    navigator.clipboard.writeText(outputElement.value).catch((error) => {
      alert(`Unable to copy markdown to clipboard: ${error}`);
    });
  });
}

const downloadButton = document.getElementById('download-button');
if (window.URL && window.File) {
  downloadButton.style.display = '';
  downloadButton.addEventListener('click', () => {
    const file = new File([outputElement.value], 'Converted Text.md', {
      type: 'text/markdown',
    });

    // Make a link to the file and click it to trigger a download. Chrome has a
    // fancy API for opening a save dialog, but other browsers do not, and this
    // is the most universal way to download a file created in the front-end.
    let url, link;
    try {
      url = URL.createObjectURL(file);
      link = document.createElement('a');
      link.href = url;
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
    } finally {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  });
}

// Get correct button ID and make it visible
const convertImagesButton = document.getElementById('download-images-button');
convertImagesButton.textContent = 'Convert Images';
convertImagesButton.style.display = 'inline-block'; // Make button visible

async function convertImageReferences() {
  console.log('Converting image references...');
  
  // Prompt for prefix
  const prefix = await prompt('Enter prefix for image names:', '');
  if (prefix === null) return; // User cancelled
  
  console.log('Using prefix:', prefix);

  if (!outputElement) {
    console.error('Output element not found');
    return;
  }

  // Get current markdown from output
  const markdown = outputElement.value;
  let imageCount = 0;

  // Function to replace with new name
  const replaceWithNewName = () => {
    imageCount++;
    return `${prefix}-image-${imageCount}.png`;
  };

  // Replace ![alt](url) format
  const updatedMarkdown = markdown.replace(
    /!\[(.*?)\]\((.*?)(?:\s+"(.*?)")?\)/g,
    (match, alt, url, title) => {
      const newName = replaceWithNewName();
      console.log(`Replacing image reference: ${url} -> ${newName}`);
      return title 
        ? `![${alt}](${newName} "${title}")` 
        : `![${alt}](${newName})`;
    }
  ).replace(
    /<img.*?src=["'](.*?)["'].*?>/g,
    (match, url) => {
      const newName = replaceWithNewName();
      console.log(`Replacing HTML image: ${url} -> ${newName}`);
      return match.replace(url, newName);
    }
  );

  // Update output only
  outputElement.value = updatedMarkdown;
  
  // Only update instructions if they exist
  if (outputInstructions) {
    outputInstructions.style.display = updatedMarkdown.trim() ? 'none' : '';
  }
}

// Add event listener
convertImagesButton.addEventListener('click', convertImageReferences);

function updateSettingsForm() {
  for (const input of settingsForm.querySelectorAll('input,select')) {
    const value = currentSettings.get(input.name);
    if (value != null) {
      if (input.type === 'checkbox') {
        input.checked = value;
      } else {
        input.value = value;
      }
    }
  }
}

settingsForm.addEventListener('change', (event) => {
  let value = event.target.value;
  if (event.target.type === 'checkbox') {
    value = event.target.checked;
  }
  currentSettings.set(event.target.name, value);
  convert();
});

window.convertDocsHtmlToMarkdown = convertDocsHtmlToMarkdown;
currentSettings.setAll(defaultOptions, { save: false });
currentSettings.load();
updateSettingsForm();

function downloadDocImages() {
  const images = document.querySelectorAll('img');
  const urls = [];
  
  images.forEach((img, index) => {
    // Get the actual rendered image URL
    const currentSrc = img.currentSrc || img.src;
    if (!currentSrc) return;

    // Try to determine file type from URL or fallback to 'png'
    let fileExt = 'png';
    if (currentSrc.includes('.')) {
      fileExt = currentSrc.split('.').pop().split('?')[0];
      // Validate extension
      if (!['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fileExt)) {
        fileExt = 'png';
      }
    }

    urls.push(`${currentSrc} => image-${index + 1}.${fileExt}`);
  });

  // Create wget command file
  const wgetCommands = urls.map(url => {
    const [src, filename] = url.split(' => ');
    return `wget "${src}" -O "${filename}" --no-check-certificate`;
  }).join('\n');

  // Download the command file
  const blob = new Blob([wgetCommands], { type: 'text/plain' });
  const blobUrl = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = 'download-images.sh';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(blobUrl);
}

