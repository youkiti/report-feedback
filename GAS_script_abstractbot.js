//やりかた　https://qiita.com/nomuranaruki/items/3c21ae803bfbf192a956
// https://qiita.com/noritsune/items/17c20dccb0eb00f2622e

//コードを設定
//SlackAppをライブラリとしてインストール 1O20VxEbcHIYIrrpe_HeqkiaAXNEjIKcTKe3rLl2r_1KJ6GQ_Ib-xkGJG 1on93YOYfSmV92R5q59NpKmsyWIQD8qnoLYk-gkQBI92C58SPyA2x1-bq

//アプリを作る　https://api.slack.com/apps/
//「Install App」タブからSlackアプリのアクセストークンを控えておく



//ID等設定
/*
function testDoPost() {
  const e = {
    postData: {
      getDataAsString: function() {
        return JSON.stringify({
          "token": "V4e1j7tf6FvZVMp4q1hueokZ",
          "team_id": "TMSG50UE4",
          "api_app_id": "A054CKHE3HB",
          "event": {
            "type": "app_mention",
            "user": "U012R9YBB2Q",
            "text": "<@U07NETFN4CV> hello world.",
            "ts": "1711439557.366379",
            "channel": "C0681Q0SU4V",
            "event_ts": "1711439557.366379",
            "client_msg_id": "79b78512-caa7-42be-b170-92fbe14ccc72",
            "blocks": []
          },
          "type": "event_callback",
          "event_id": "Ev06RB349534",
          "event_time": 1711439557
        });
      }
    }
  };
  Logger.log("テスト開始");
  doPost(e);
  Logger.log("テスト終了");
  
  // ログを強制的に表示
  console.log(Logger.getLog());
}
*/

function doPost(e) {

  //受信データをパース
  const json = JSON.parse(e.postData.getDataAsString());
  Logger.log(json);

  if (json.type === 'url_verification') {
    return ContentService.createTextOutput(json.challenge);
  }

  const event_id = json.event_id;
  const cache = CacheService.getScriptCache();

  const isProcessed = cache.get(event_id);
  if (isProcessed) return;
  cache.put(event_id, true, 601);

  //サブタイプが設定されたイベント
  if('subtype' in json.event) return;

  const botId = PropertiesService.getScriptProperties().getProperty('slackBotId');
  if (json.event && json.event.user && json.event.user !== botId) {
    const channel = json.event.channel;
    const text = json.event.text;
    const ts = json.event.ts;
    Logger.log(text);

  // textにbotIdが含まれているかどうかを確認
  if (text.includes(botId)) {
    Logger.log("botIdがメッセージに含まれています");

    const resMessage = callClaude(text);  // ←これを修正すれば変わる！
    Logger.log("Claude APIレスポンス: " + resMessage);
    setCellValueWithTimestamp(json);
    setCellValue(resMessage);
    Logger.log(resMessage);
    sendSlack(channel, resMessage, ts);
  }
}
  return;
}

//SlackBotsを通してメッセージを送信する
function sendSlack(channel, message, ts) {
  const slackToken = PropertiesService.getScriptProperties().getProperty('slackBotToken');
  const slackApp = SlackApp.create(slackToken);
  
  // メッセージがオブジェクトの配列の場合、テキストを抽出
  if (Array.isArray(message) && message.length > 0 && message[0].hasOwnProperty('text')) {
    message = message[0].text;
  }
  
  slackApp.postMessage(channel, message, { thread_ts: ts });
}

const spreadsheetId = PropertiesService.getScriptProperties().getProperty('spread');

// スプレッドシートに値を書き込む関数(ユーザーの入力)
function setCellValueWithTimestamp(json) {
  let sheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName("シート1");
  let columnA = sheet.getRange("A:A").getValues();
  // Find the first empty cell in column A
  for (let i = 0; i < columnA.length; i++) {
    if (columnA[i][0] == "") {
      let timestamp = new Date(); // Get current date and time
      // Write the timestamp, userId, and userPrompt to the first empty cell found

      sheet.getRange(i + 1, 1).setValue(timestamp); // Set timestamp in column A
      sheet.getRange(i + 1, 2).setValue(json);    // Set input in column B

      var userId = json.event.user;
      var textValue = json.event.text;
      sheet.getRange(i + 1, 3).setValue(userId);
      sheet.getRange(i + 1, 4).setValue(textValue);
      break;
    }
  }
}

// スプレッドシートに値を書き込む関数(ボットの応答)
function setCellValue(text) {
  // シートを取得する
  let sheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName("シート1");
  // A列の全データを取得する
  let columnA = sheet.getRange("A:A").getValues();
  // A列のデータを順番にチェックし、最初の空白セルを見つける
  for (let i = 0; i < columnA.length; i++) {
    if (columnA[i][0] === "") {
      // 空白セルの範囲オブジェクトを取得する
      let cell = sheet.getRange(i , 5);
      // セルに値を入力する
      cell.setValue(text);
      // 処理を終了する
      break;
    }
  }
}

function testCallClaude() {
  const testPrompt = "テスト用のプロンプト";
  const result = callClaude(testPrompt);
  Logger.log("Test result: " + result);
}

//以下にClaude3 APIを使ったボットの関数
function callClaude(prompt) {
  var endpoint = "https://api.anthropic.com/v1/messages";
  const ApiKey = PropertiesService.getScriptProperties().getProperty('ClaudeApiKey');
  var data = {
    "model": "claude-3-5-sonnet-20240620",
    "max_tokens": 4096,
    "temperature": 0,
    "system" : `#フロー提出されたレポートを以下のルールに従って医学系学会の抄録形式に要約してください。文字数は指定した文字数の範囲内で出力してください。#ルール以下の条件を厳守して出力してください##1.	表題:まず提出されたレポートを元に、読者の興味を引く、簡潔でわかりやすい表題案を2つ出力する2.	長さ:表題案を除いて抄録は必ず1400～1800文字で出力する3.	構成：「はじめに」、「症例紹介」、「考察」のセクションは必ず含める。「症例紹介」にはリハビリテーション初期評価を含む。提出されたレポートに症例に対する介入経過や結果(リハビリテーション最終評価など)の記載がある場合は、セクションに「介入経過」や「結果」を必ず含める。case by caseで「統合と解釈」、「問題点の抽出」、「目標設定」、「治療プログラム」、「結論」、「参考・引用文献」などのセクションを含めても良いが、重要性は低いため、最小限にとどめ、簡潔に記載する。4.	形式:各セクションを明確に区分し、具体的な記述を心がける。5.	重要性:症例報告を行う上で、患者のどのような問題点に着目して、評価または介入をしたのか、それに対する考察が読者に伝わるように論理一貫性のある内容で要約する。特に「介入経過」と「考察」のセクションは、他のセクションよりも重要であり、抄録全体に占める割合を増やしてよいので詳細に記述する。6.	専門用語:適切な医学用語を使用し、必要に応じて略語を導入する（初出時はフルスペルを記載）7.	データ:重要な数値データや結果を含める8.	引用：引用文献は以下どちらかの表記方法で統一する 1) 考察のセクション内で引用した文章に続けて(第一著者, 年号)と記載する 2) 文章内で引用部分を番号(1)など)で示し、最後にリストアップする
    ＃出力：
    （表題：２つの表題案）
    （抄録：実際に要約した文章）
    `,
    "messages": [
      {"role": "user", "content": prompt}
    ]
  };
    var options = {
    "method": "POST",
    "headers": {
      "Content-Type": "application/json",
      "X-API-Key": ApiKey,
      "anthropic-version": "2023-06-01"
    },
    "payload": JSON.stringify(data)
  };

  try {
    var response = UrlFetchApp.fetch(endpoint, options);
    var responseText = response.getContentText();
    Logger.log("Claude APIの生のレスポンス: " + responseText);  // APIのレスポンスをそのままログに出力
    
    var responseJson = JSON.parse(responseText);

    // Claude APIのレスポンス構造を確認し、正しく内容を抽出
    if (responseJson.hasOwnProperty('content')) {
      var assistantResponse = responseJson.content;  // 正しいプロパティを確認
      Logger.log("Claude APIからの抽出された応答: " + assistantResponse);  // Claudeのレスポンスをログに出力
      return assistantResponse;
    } else {
      Logger.log("Claude APIのレスポンスに 'content' が見つかりません");
      return "エラー: Claudeのレスポンスが不正です";
    }
  } catch (e) {
    Logger.log("API呼び出し中にエラーが発生しました: " + e.message);
    return "エラー: API呼び出し中に問題が発生しました";
  }
}
