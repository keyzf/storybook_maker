import { StoryPage } from "../types";

const template = `
<!DOCTYPE html>

<style>
  @font-face {
    font-family: HobbyHorseNF;
    src: url(HobbyHorseNF.otf);
  }

  .stop-scrolling {
    touch-action: none;
  }

  html,
  body {
    margin: 0 auto;
    padding: 0;
    max-width: 1200px;

    background-size: cover;
    background-position: center top;
  }

  div.container {
    display: flex;
    justify-content: center;
    max-height: 100%
  }

  div.page {
    display: flex;
    height: 100%;
    position: relative;
    justify-content: center;
    align-items: center;
  }

  div.picture {
    display: flex;
    justify-content: center;
  }

  div.story {
    font-family: HobbyHorseNF;
    display: flex;
    align-items: center;
    margin: 10px;
    opacity: 0.8;
    background-color: rgba(0, 0, 0, 0.5);
    color: black;
    padding: 20px;
    background: white;
    border-radius: 25px;
    bottom: 10px;
  }

  div.controls {
    display: flex;
    align-content: stretch;
    position: fixed;
    bottom: 0;
    z-index: 10;
    width: 100%;
    max-width: 1200px;
  }

  div.controls button {
    width: 50%;
    height: 4em;
  }

  @media (max-width: 600px) {
    div.container {
      display: flex;
      flex-direction: column;
      justify-content: start;
      height: 100vh;
    }

    div.story {
      flex-direction: column;
    }

    div.picture {
      align-items: center;
    }

    img {
      max-height: 100%;
      max-width: 100%;
    }

    div.page {
      flex-direction: column;
    }
  }

  @media (min-width: 600px) {
    div.container-left {
      flex-direction: row;
      width: 40%;
    }

    div.container-right {
      flex-direction: row;
      width: 60%;
    }

    div.story {
      flex-direction: row;
    }

    img {
      max-width: 100%;
    }

    div.page {
      flex-direction: row;
      height: 100vh;
    }

    div.picture {
      margin-right: 1em;
    }
  }
</style>

<script>
  window.addEventListener("scroll", (e) => {
    e.preventDefault();
    changePage(0);
  });

  function isMobile() {
    return window.innerWidth < 600;
  }

  function getSelector() {
    return isMobile() ? ".container" : ".page";
  }

  function onLoad() {
    changePage(0);
  }

  function scrollToElement(element) {
    element.scrollIntoView({ behavior: "instant", block: "start" });
  }

  function changePage(offset) {
    const selector = getSelector();
    const pages = document.querySelectorAll(selector);

    let activePage = -1;
    for (const [i, page] of Object.entries(pages)) {
      if (page.classList.contains("active")) {
        activePage = Number(i);
        break;
      }
    }

    if (pages[activePage + offset]) {
      pages[activePage].classList.remove("active");
      pages[activePage + offset].classList.add("active");
      scrollToElement(pages[activePage + offset]);
    }
  }
</script>

<html lang="en-US">
  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"
  />
  <body onload="onLoad()" class="stop-scrolling">
    <div class="controls">
      <button onclick="changePage(-1)">Back</button>
      <button onclick="changePage(1)">Forward</button>
    </div>
    [##STORY##]
  </body>
</html>
`;

function getStoryPage(
  paragraph: string,
  isEdited: boolean,
  pageNumber: number
): string {
  return `
  <div class="page active">
    <div class="container container-left active">
      <div class="story">
        <h1 class="text">
          ${paragraph}
        </h1>
        </div>
      </div>
      <div class="container container-right">
        <div class="picture">
          <img src="./${isEdited ? "final" : "0"}-${pageNumber}.jpg" />
        </div>
      </div>
    </div>
  </div>
`;
}

export function getTemplate(pages: StoryPage[], isEdited: boolean): string {
  return template.replace(
    "[##STORY##]",
    pages
      .map(({ paragraph }, index) => getStoryPage(paragraph, isEdited, index))
      .join("\n")
  );
}
