const greeting = document.querySelector<HTMLHeadingElement>("#greeting");
if (greeting) greeting.textContent = `hello · ${chrome.runtime.getManifest().name}`;
