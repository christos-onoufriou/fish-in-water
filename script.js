UnicornStudio.addScene({
    elementId: "gravityCoding",
    fps: 100,
    scale: 1,
    dpi: 1,
    lazyLoad: false,
    filePath: "./WaterEffect/effect.json",
    interactivity: {
      mouse: {
        disableMobile: true,
      },
    },
  })
    .then((scene) => {
      console.log("Scene is ready");
    })
    .catch((err) => {
      console.error("Error loading scene:", err);
    });
