import { Dialog } from 'jsfreemaplib';
import XHRPromise from './app/xhrpromise.js';

class Uploader {

    constructor(id, parentId, options) {
        var actions =  {};
        var k = options.uploadLabel || 'Upload';
        actions[k] = this.uploadProcessor.bind(this);
        actions["Close"] = () => {this.dialog.hide() };
        this.dialog =  new Dialog (parentId, actions,
                        options.style
                           );
        if(options.dialogDivId) {
            this.dialog.div.id = options.dialogDivId;
        }
   
        const multiple = options.multiple === true ? 'multiple': ''; 
        let content = 
            `<h2>${options.heading}</h2>` +
            `<p>${options.content}</p>` +
            '<form method="post" enctype="multipart/form-data">' +
            `Select your file (<strong>max 8MB</strong>) : <input type="file" id="file_${id}" ${multiple} /> <br />` +
            `<progress id="progress_${id}" value="0" max="100" style="width: 90%"></progress> <br />` +
            `<span id="uploadProgress_${id}"></span><br />`;
            

        Object.keys(options.additionalFormInput).forEach (k => {
            content += 
            `<input type='${options.additionalFormInput[k].type}' id='${k}' value='${options.additionalFormInput[k].value}' ` +  (options.additionalFormInput[k].checked ? `checked='${options.additionalFormInput[k].checked}'`  : "") + `/><label for='${k}'>${options.additionalFormInput[k].label}</label><br />`;
        });
        content += options.additionalContent || '';
        content += `</form><p id='uploadStatus_${id}' class='error'></p>`;

        this.dialog.setContent(content);
        this.id = id;
        this.options = options || {};
        this.options.successMsg = options.successMsg || 'Successfully uploaded.';
    }

    show() {
        this.dialog.show();
        if(this.options.onAddAdditionalContent) this.options.onAddAdditionalContent();
    }
        
    async uploadProcessor() {
        document.getElementById(`uploadStatus_${this.id}`).innerHTML = document.getElementById(`uploadProgress_${this.id}`).innerHTML = ""; 
        const errors = {}, warnings = {}; 
        let nSuccessful = 0;
        this.files = document.getElementById(`file_${this.id}`).files;
        if(this.files.length == 0) {
            document.getElementById(`uploadStatus_${this.id}`).innerHTML = 'No files selected!';
        } else {
            document.getElementById(`uploadStatus_${this.id}`).innerHTML = '<strong>Filtering files...</strong>'; 
            let includedFiles = [];
            try {
                const incf = await this.options.filterer(this.files);
                includedFiles = incf.includedFiles;
                document.getElementById(`uploadStatus_${this.id}`).innerHTML = '';
                console.log(`Included ${includedFiles.length} of ${this.files.length}.`);
            } catch(e) {
                document.getElementById(`uploadStatus_${this.id}`).innerHTML = `Error with filtering: ${e}`;
            }
            for(let i=0; i < includedFiles.length; i++) {
                console.log(`Included file ${i}: info:`);
                console.log(includedFiles[i]);
                var file = includedFiles[i].file;
                var formData = new FormData();
                formData.append("file", file);
                if(includedFiles[i].latitude !== undefined && 
                   includedFiles[i].longitude !== undefined) {
                    formData.append("lat", includedFiles[i].latitude);
                    formData.append("lon", includedFiles[i].longitude);
                }
                if(includedFiles[i].PoseHeadingDegrees) {
                    formData.append("PoseHeadingDegrees", includedFiles[i].PoseHeadingDegrees);
                }
                Object.keys(this.options.additionalFormInput).forEach (k=> {
                    formData.append(k, this.options.additionalFormInput[k].type == 'checkbox' ? document.getElementById(k).checked : document.getElementById(k).value);        
                });

                const request = new XHRPromise({
                    url : this.options.url,
                    progress: e=> {
                        var pct = Math.round (e.loaded/e.total * 100, e.loaded, e.total);
                        this.showProgress(pct, e.loaded, e.total, includedFiles, i);
                    }
                });

                try {
                    console.log('Sending request');
                    const result = await request.post(formData); // result===e.target
                    this.showProgress(0);
                    var json = JSON.parse(result.responseText);
                    console.log('Response:');
                    console.log(json);
                    if(json.error) {
                        document.getElementById(`uploadStatus_${this.id}`).innerHTML = `<strong>File ${file.name}:</strong> ${json.error}`;
                        errors[file.name] = json.error;
                    } else if (json.warning) {
                        document.getElementById(`uploadStatus_${this.id}`).innerHTML = `<strong>File ${file.name}:</strong> Successful upload, but ${json.warning}`;
                        warnings[file.name] = json.warning;
                        nSuccessful++;
                    } else if (result.status != 200) {
                        document.getElementById(`uploadStatus_${this.id}`).innerHTML = `<strong>File ${file.name}:</strong> HTTP status code ${result.status}`;
                        errors[file.name] = `HTTP status code ${result.status}`;
                    } else {
                        document.getElementById(`uploadStatus_${this.id}`).innerHTML = `<strong>File ${file.name}:</strong> ${this.options.successMsg}`;
                        nSuccessful++;
                    }
                } catch(e) {
                    const error = 'Network error when uploading. Detail: ' + e; 
                    document.getElementById(`uploadStatus_${this.id}`).innerHTML = error;
                    errors[file.name] = error;
                }
            }
        
            if(this.options.onSuccess && nSuccessful > 0) {
                this.options.onSuccess(json, document.getElementById(`uploadStatus_${this.id}`));
            } 
            const errorFiles = Object.keys(errors), warningFiles = Object.keys(warnings);
            if (includedFiles.length > 1) {
                document.getElementById(`uploadStatus_${this.id}`).innerHTML = "";
                const text = document.createTextNode(`Successfully uploaded ${nSuccessful} files out of a total of ${includedFiles.length} with ${Object.keys(errors).length} errors and ${Object.keys(warnings).length} warnings. Please review these carefully.`);
                document.getElementById(`uploadStatus_${this.id}`).appendChild(text);
                if(errorFiles.length >= 1 || warningFiles.length >= 1) {

                    const btn = document.createElement('input');
                    btn.type = 'button';
                    btn.value = `Details`;
                    btn.addEventListener('click', e=> {
                        const dlg2 =  new Dialog (this.options.dialogDivId, {
                            'OK': ()=>{ dlg2.hide(); } 
                            }, { 
                                top: '20px', 
                                left: '20px', 
                                width: 'calc(100% - 40px)', 
                                height: 'calc(100% - 40px)', 
                                position: 'absolute', 
                                backgroundColor: '#008000' 
                            } 
                        );
                        const content = errorFiles.map(k => `${k}: ERROR: ${errors[k]}`).join('\n') + warningFiles.map(k =>`${k}: WARNING: ${warnings[k]}`).join('\n');
                        dlg2.setContent(`<textarea readonly style="border: 1px solid black; background-color: white; color: black; height: calc(100% - 50px); width: 100%; text-align: left">${content}</textarea>`);
                        dlg2.show();    
                    });
                    document.getElementById(`uploadStatus_${this.id}`).appendChild(btn);
                }
            } else {
                let statusMessage = "Successful upload.";
                if(errorFiles.length == 1) {
                    statusMessage = `<strong>ERROR:</strong> ${errors[errorFiles[0]]}`;
                } else if (warningFiles.length == 1) {
                    statusMessage = `<strong>WARNING:</strong> ${warnings[warningFiles[0]]}`;
                } else if (nSuccessful == 0) {
                    alert('WARNING: No files uploaded. Please ensure none are larger than 8MB. Note that panoramas without lat/lon information will be rejected..');
                    statusMessage = "";
                }
                document.getElementById(`uploadStatus_${this.id}`).innerHTML = statusMessage;
            }
            document.getElementById(`file_${this.id}`).value = '';
        }
    }

    showProgress(pct, loaded, total, files, idx) {
        document.getElementById(`uploadProgress_${this.id}`).innerHTML =
            pct>0 ? `<strong>${files[idx].file.name}</strong> (${idx+1} of ${files.length}): uploaded ${loaded} total: ${total} (${pct}%)`: "";
        document.getElementById(`progress_${this.id}`).value=Math.round(pct);
    }

    setMessage(msg) {
        document.getElementById(`uploadStatus_${this.id}`).innerHTML = msg;
    }
}

export default Uploader;

