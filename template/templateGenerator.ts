import { StoryPage } from "../types";

const template = `
<!DOCTYPE html>

<style>
  @font-face {
    font-family: HobbyHorseNF;
    src: url(HobbyHorseNF.otf);
  }

  html,
  body {
    margin: 0 auto;
    padding: 0;
    max-width: 1200px;
    background: lightslategray;

    height: 100%;
    background-size: cover;
    background-position: center top;
  }

  div.page {
    position: relative;
    display: flex;
    justify-content: center;
    align-items: flex-end;
    width: 100%;
    height: 100%;

    background-size: contain;
    background-repeat: no-repeat;
    background-position: center;
  }

  div.hide_button {
    background-color: rgba(0, 0, 0, 0.5);
    color: white;
    padding: 10px;
    border-radius: 25px;
  }

  div.story {
    font-family: HobbyHorseNF;
    text-align: center;
    display: flex;
    align-items: center;
    flex-direction: column;
    margin: 10px;
    opacity: 0.8;
    background-color: rgba(0, 0, 0, 0.5);
    color: black;
    padding: 20px;
    background: white;
    border-radius: 25px;
    bottom: 10px;
  }
</style>

<script>
  function toggleElement(clicked, index) {
    const storyElement = document.querySelectorAll(".text")[index];
    const style = getComputedStyle(storyElement);
    console.log(style.display);
    if (style.display === "block") {
      clicked.innerHTML = "Show";
      storyElement.style.display = "none";
    } else {
      clicked.innerHTML = "Hide";
      storyElement.style.display = "block";
    }
  }
</script>

<html lang="en-US">
  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"
  />
  <body>
    [##STORY##]
  </body>
</html>
`;

function getStoryPage(
  index: number,
  paragraph: string,
  imageUrl: string
): string {
  return `
    <div class="page" style="background-image: url('${imageUrl}');">
      <div class="story">
        <h1 class="text">
          ${paragraph}
        </h1>
        <button class="hide_button" onclick="toggleElement(this, ${index})">
          Hide
        </button>
      </div>
    </div>
`;
}

export function getTemplate(pages: StoryPage[]): string {
  return template.replace(
    "[##STORY##]",
    pages
      .map(({ paragraph }, index) =>
        getStoryPage(index, paragraph, `${index}-1.png`)
      )
      .join("\n")
  );
}
