"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const readline_1 = require("readline");
const axios_1 = __importDefault(require("axios"));
const node_html_parser_1 = require("node-html-parser");
const download_1 = require("./download");
async function main() {
    // 1. 블로그 아이디 입력 후 카테고리 파싱
    const blogId = await receiveInput("블로그 ID를 입력하세요.");
    const url = `https://blog.naver.com/WidgetListAsync.naver?blogId=${blogId}&enableWidgetKeys=category`;
    const categoryResponse = await axios_1.default.get(url, {
        headers: {
            Host: "blog.naver.com",
            Referer: `https://blog.naver.com/PostList.naver?blogId=${blogId}`,
        },
    });
    let categoryData = {};
    eval(`categoryData = ${categoryResponse.data}`);
    const html = (0, node_html_parser_1.parse)(categoryData.category.content);
    const htmlCategories = html.querySelectorAll(".itemfont");
    const categories = {};
    console.log("\n카테고리 목록:");
    htmlCategories.map((category) => {
        categories[category.id.slice(8)] = category.innerHTML.trim();
        console.log(`${category.id.slice(8)}:`, category.innerHTML.trim());
    });
    // 2. 카테고리 선택 후 게시물 파싱
    let selectedCategory = "";
    while (selectedCategory == "") {
        const input = await receiveInput("\n카테고리 번호를 입력하세요.");
        if (categories[input]) {
            selectedCategory = input;
        }
        else {
            console.log("잘못된 카테고리 번호입니다.");
        }
    }
    // 3. 게시물 파싱
    const postPageCount = await getPageCount(blogId, selectedCategory);
    const postData = [];
    for (let page = 1; page <= postPageCount; page++) {
        const postPageData = await getPosts(blogId, selectedCategory, page);
        postData.push(...postPageData);
    }
    // 4-1. 다운로드 경로 지정
    let downloadPath = await receiveInput("\n다운로드 경로를 입력하세요. (기본: ./downloads)");
    if (downloadPath == "") {
        downloadPath = "./downloads";
    }
    // 4-2. 게시물 별 다운로드
    console.log(`\n${categories[selectedCategory]} 카테고리의 첨부파일 다운로드를 시작합니다.`);
    await Promise.all(postData.map(async (post) => {
        const downloads = await (0, download_1.getDownloads)(blogId, post.logNo);
        if (downloads.length === 0) {
            console.log(`${post.title} - 첨부파일 없음`);
            return;
        }
        console.log(`${post.title} - 첨부파일 ${downloads.length}개`);
        await Promise.all(downloads.map(async (download) => {
            await (0, download_1.downloadFile)(download.url, downloadPath, download.fileName);
            console.log(`${download.fileName} 다운로드 완료`);
        }));
    }));
    console.log("\n모든 다운로드가 완료되었습니다. 저장 위치:", downloadPath);
}
function receiveInput(message) {
    return new Promise((resolve, reject) => {
        try {
            console.log(message);
            const rl = (0, readline_1.createInterface)({
                input: process.stdin,
                output: process.stdout,
            });
            rl.on("line", (line) => {
                rl.close();
                resolve(line);
            });
        }
        catch (err) {
            reject(err);
        }
    });
}
async function getPageCount(blogId, categoryNo) {
    const postResponse = await axios_1.default.get(`https://blog.naver.com/PostTitleListAsync.naver?blogId=${blogId}&currentPage=1&categoryNo=${categoryNo}&countPerPage=5`);
    const postDataJSON = JSON.parse(postResponse.data.replaceAll("\\", ""));
    const postPageCount = Math.ceil(Number(postDataJSON.totalCount) / 30);
    return postPageCount;
}
async function getPosts(blogId, categoryNo, page) {
    const postResponse = await axios_1.default.get(`https://blog.naver.com/PostTitleListAsync.naver?blogId=${blogId}&currentPage=${page}&categoryNo=${categoryNo}&countPerPage=30`);
    const postDataJSON = JSON.parse(postResponse.data.replaceAll("\\", ""));
    const postData = postDataJSON.postList.map((post) => {
        const returnData = {
            title: post.title,
            logNo: post.logNo,
        };
        returnData.title = decodeURIComponent(returnData.title.replaceAll("+", " "));
        return returnData;
    });
    postData.reverse();
    return postData;
}
main();
