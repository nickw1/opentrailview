class XHRPromise {
    constructor(options) {
        this.url = options.url;
        this.xhr2 = new XMLHttpRequest();
        this.xhr2.upload.addEventListener("progress", options.progress);
    }

    
    post(formData) {
        return new Promise((resolve, reject) => {
            this.xhr2.addEventListener("load", e=> {
                resolve(e.target);
            });

            this.xhr2.addEventListener("error", e=> {
                reject(e);
            });
            this.xhr2.open("POST", this.url);
            this.xhr2.send(formData);
        });
    }
}
  
export default XHRPromise;
