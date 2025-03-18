//やりかたの参考　https://qiita.com/nomuranaruki/items/3c21ae803bfbf192a956
// https://qiita.com/noritsune/items/17c20dccb0eb00f2622e

//コードを設定
//SlackAppをライブラリとしてインストールする必要あり

//アプリを作る　https://api.slack.com/apps/
//「Install App」タブからSlackアプリのアクセストークンを控えておく

//プロジェクトの設定からスクリプトプロパティを設定　ClaudeApiKey slackBotId slackBotToken spread (やり取りを保存するためのGoogleスプレッドシート)

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


  const resMessage = callClaude(text);  ////////////////////////////←これを修正すれば変わる！
  setCellValueWithTimestamp(json);
  setCellValue(resMessage);
  Logger.log(resMessage)
  sendSlack(channel, resMessage,ts);

  }
 

  return;
}

//SlackBotsを通してメッセージを送信する
function sendSlack(channel, message,ts) {
  const slackToken = PropertiesService.getScriptProperties().getProperty('slackBotToken');
  const slackApp = SlackApp.create(slackToken);
  slackApp.postMessage(channel, message,{ thread_ts: ts });
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
      var textValue = json.event.text
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
  // C列の全データを取得する
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


//以下にClaude3 APIを使ったボットの関数
function callClaude(prompt) {
  var endpoint = "https://api.anthropic.com/v1/messages";
  const ApiKey = PropertiesService.getScriptProperties().getProperty('ClaudeApiKey');
  var data = {
    "model": "claude-3-opus-20240229",
    "max_tokens": 4096,
    "temperature": 0,
    "system" : "#役割 あなたは、細部への鋭い観察眼と、言語、スタイル、文法への深い理解を備えたリハビリテーション領域のAIエディターです。これから入力するのは、新人コメディカルスタッフが書いたケースレポートです。あなたの仕事は、提出されたケースレポートを洗練および改善し、高度なコピー編集技術と提案を提供して、学術論文に適するように、テキスト全体の品質を向上させることです。
#フロー　以下の手順に従って、提出されたレポートの文章校正をしてください。なお、フィードバックコメントは、以下の手順毎に長文でも構わないので要約せず具体的な修正案とともに出力してください。ただし、「, ．」を「、 。」へ修正するコメントは不要です。また、提出された本文に記載されている内容の中で修正してください。本文に記載が無い内容を勝手に書き加えないでください。
1. コンテンツを注意深く読み、「文法」、「句読点」、「スペル」、「構文」、「スタイル」の点で改善が必要な領域を特定してください。その上で、テキストを改良するための具体的で実行可能な提案を提供してください。日付や氏名は匿名化出来ていれば記載方法はどのような形でも構わない(X年、Z+10日、A氏) 
2. 略語に関しては、正式名称や説明を記載する必要はありません。「スタイル」に関しては、敬体（です・ます調）を完全に削除し、常体（だ・である調）に統一してください。
3. 明瞭さ、簡潔さ、インパクトを向上させるために、単語の選択、文の構造、およびフレーズの改善案を提供してください。ただし、「以下が考えられる」など箇条書きや番号付きリストを用いた記載は避けてください。接続詞や転換語を適切に使用し、関連性や重要度を示唆しながら、流れのある文章として説明するよう心がけてください。
4. 文章の調子や内容に一貫性があり、対象読者や目的に適切であるかを確認してください。専門的な情報を維持しつつ、読みやすさと理解しやすさのバランスを取ってください。
5. パラグラフ・ライティングの作法となっているかを確認し、必要に応じて具体的な改善案を提供してください。各パラグラフが一つの主題を扱い、論理的に繋がっているか確認してください。
6. 校正後に、自身の修正内容について短い自己評価を行い、修正のポイントや改善できた点を説明してください。
7. 最後に、すべての提案を考慮した、完全に編集されたバージョンをバッククォート3つで囲まれたSlackコードブロックとして出力してください。フィードバックはコードブロックの外にお願いします。
",
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

  var response = UrlFetchApp.fetch(endpoint, options);
  var responseText = response.getContentText();
  var responseJson = JSON.parse(responseText);
  var assistantResponse = responseJson.content[0].text; 
  return assistantResponse;
}

