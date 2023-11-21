import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";


const pdfPath = 'path to your pdf';



(async () => {
    const loadingTask = getDocument(pdfPath);
    const doc = await loadingTask.promise;

    const numPages = doc.numPages;
    console.log("# Document Loaded");
    console.log("Number of Pages: " + numPages);
    console.log();


    const data = await doc.getMetadata()
    console.log("# Metadata Is Loaded");
    console.log("## Info");
    console.log(JSON.stringify(data.info, null, 2));
    console.log();
    if (data.metadata) {
        console.log("## Metadata");
        console.log(JSON.stringify(data.metadata.getAll(), null, 2));
        console.log();
    }


    const loadPage = function (pageNum) {
        return doc.getPage(pageNum).then(function (page) {
            console.log("# Page " + pageNum);
            // const viewport = page.getViewport({ scale: 1.0 });
            const viewport = page.getViewport();
            console.log("Size: " + viewport.width + "x" + viewport.height);
            console.log('pagex:', page);
            return page
                .getTextContent()
                .then(function (content) {
                    // Content contains lots of information about the text layout and
                    // styles, but we need only strings at the moment
                    // const strings = content.items.map(function (item) {
                    //     return item.str;
                    // });
                    // console.log("## Text Content");
                    // console.log(strings.join(" "));
                    content.items.forEach((item) => {
                        console.log(item)
                    })
                    // Release page resources.
                    page.cleanup();
                })
                .then(function () {
                    console.log();
                });
        });
    };


    let lastPromise = loadPage(1);
    for (let i = 2; i <= numPages; i++) {
        lastPromise = lastPromise.then(loadPage.bind(null, i));
    }
    await lastPromise;
})();