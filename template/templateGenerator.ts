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

  div.hide_button {
    background-color: rgba(0, 0, 0, 0.5);
    color: white;
    padding: 10px;
    border-radius: 25px;
  }

  @media (max-width: 600px) {
    div.container {
      display: flex;
      flex-direction: column;
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
    }

    div.page {
      flex-direction: column;
    }
  }

  @media (min-width: 600px) {
    div.container {
      flex-direction: row;
      width: 50%;
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
  <div class="page">
    <div class="container">
      <div class="story">
        <h1 class="text">
          ${paragraph}
        </h1>
        </div>
      </div>
      <div class="container">
        <div class="picture">
          <img src="${imageUrl}" />
        </div>
      </div>
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
