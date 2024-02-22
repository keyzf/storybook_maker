"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var jimp_1 = require("jimp");
function makeStory() {
    return __awaiter(this, void 0, void 0, function () {
        var oolamaResp, oolamaJson, parsedResponse, _i, _a, _b, index, description, sdTxt2ImgResp, imageResp, font;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, fetch("http://localhost:11434/api/generate", {
                        method: "POST",
                        body: JSON.stringify({
                            model: "mistral",
                            prompt: "Make me a children's story in five separate paragraphs. \n         The stories are about a child named Gavin. \n         Respond using JSON and put the story in a key called story and have each paragraph be a string stored in an array.\n         Put the descriptions in a key called descriptions and have each description be a string stored in an array.\n         The descriptions must visually describe exactly what is happening and Gavin should be the focus of each description.",
                            stream: false,
                            format: "json",
                        }),
                    })];
                case 1:
                    oolamaResp = _c.sent();
                    return [4 /*yield*/, oolamaResp.json()];
                case 2:
                    oolamaJson = _c.sent();
                    parsedResponse = JSON.parse(oolamaJson.response);
                    console.log("Parsed response: ", parsedResponse);
                    _i = 0, _a = parsedResponse.descriptions.entries();
                    _c.label = 3;
                case 3:
                    if (!(_i < _a.length)) return [3 /*break*/, 8];
                    _b = _a[_i], index = _b[0], description = _b[1];
                    return [4 /*yield*/, fetch("http://127.0.0.1:7860/sdapi/v1/txt2img", {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                            },
                            body: JSON.stringify({
                                prompt: "<lora:el gavin:1> ".concat(description.replace("Gavin", "A youung toddler named [el gavin]")),
                                negative_prompt: "",
                                // styles: [],
                                seed: -1,
                                // subseed: -1,
                                //subseed_strength: 0,
                                //seed_resize_from_h: -1,
                                //seed_resize_from_w: -1,
                                sampler_name: "DPM++ 2M Karras",
                                batch_size: 1,
                                //n_iter: 5, // FIXME: Is this weird?
                                steps: 50,
                                cfg_scale: 6,
                                width: 512,
                                height: 768,
                                restore_faces: true,
                                tiling: false,
                                /*do_not_save_samples: false,
                                do_not_save_grid: false,
                                eta: 0,
                                denoising_strength: 0,
                                s_min_uncond: 0,
                                s_churn: 0,
                                s_tmax: 0,
                                s_tmin: 0,
                                s_noise: 0,*/
                                // override_settings: {},
                                // override_settings_restore_afterwards: true,
                                //refiner_checkpoint: "string",
                                refiner_switch_at: 0.8,
                                disable_extra_networks: false,
                                //comments: {},
                                /*enable_hr: false,
                                firstphase_width: 0,
                                firstphase_height: 0,
                                hr_scale: 2,
                                hr_upscaler: "string",
                                hr_second_pass_steps: 0,
                                hr_resize_x: 0,
                                hr_resize_y: 0,
                                hr_checkpoint_name: "string",
                                hr_sampler_name: "string",
                                hr_prompt: "",
                                hr_negative_prompt: "",*/
                                //sampler_index: "DPM++ 2M Karras",
                                //script_name: "string",
                                //script_args: [],
                                send_images: true,
                                save_images: true,
                                //alwayson_scripts: {},
                            }),
                        })];
                case 4:
                    sdTxt2ImgResp = _c.sent();
                    return [4 /*yield*/, sdTxt2ImgResp.body];
                case 5:
                    imageResp = _c.sent();
                    return [4 /*yield*/, jimp_1.default.loadFont(jimp_1.default.FONT_SANS_32_BLACK)];
                case 6:
                    font = _c.sent();
                    _c.label = 7;
                case 7:
                    _i++;
                    return [3 /*break*/, 3];
                case 8: return [2 /*return*/, 0];
            }
        });
    });
}
makeStory();
