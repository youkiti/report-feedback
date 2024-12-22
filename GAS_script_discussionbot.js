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

  // textにbotIdが含まれているかどうかを確認
  if (text.includes(botId)) {
    Logger.log(text);

    const resMessage = callClaude(text);  // ←これを修正すれば変わる！
    setCellValueWithTimestamp(json);
    setCellValue(resMessage);
    Logger.log(resMessage);
    sendSlack(channel, resMessage, ts);
  }
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
    "system" : `#役割
あなたはリハビリテーション部の新人教育指導者です。これから入力するのは、新人職員が書いたケースレポートです。対話を通じて、新人職員がケースレポートを完成させるサポートをするのがあなたの役割です。

#フロー
・提出されたレポートを査読し、本文中に以下のチェックポイントのStep➀から③が記載されているかを確認してください。その上で、記載内容が「合格」か「要修正」かをコメントしてください。必ずチェックポイントのStep1から順に査読・コメントを実施してください。
・結果が「要修正」の場合は、一旦そこで査読を止めて、次のStepの査読・コメントは出力しないでください。そして「要修正」の理由と改善案を提示してください。
・結果が「合格」の場合は、肯定するだけでなく、より質の高いレポートにするための改善案を必ず出力してください。その後、次のStepの査読をすすめてください。
・コメントを出力する際は、不足情報の追記を促すだけでは無く、論理一貫性のあるレポートにするため優先順位を明示し、重要なポイントから取り組むよう具体的な提案をしてください。
・出力するコメントは長文でもかまわないので、要約せずに出力してください。新人職員が自身で考え、記述する力を身につけることも重要な課題です。step by stepで教えてください。

＃チェックポイント
Step➀: 症例や介入結果の要約と解釈
目的：「症例の特徴や特性」、「リハビリテーション介入結果の解釈」に関して簡潔明瞭に記載する。

判定基準：
・ある程度、読み手にわかりやすい記載ができていれば「合格」。本文中に記載が無い場合でも別項に記載している旨を説明・記載していれば問題ない。
・「症例の特徴や特性」、「リハビリテーション介入結果の解釈」に関する記載が読み取れない場合は「要修正」

フィードバック時の注意点：
・「疾患名」「性別」「年齢」「現病歴」などの患者情報を改めて説明する必要は無い。
・結果の新規性や実際的な意義（応用可能性など）まで記載出来なくても良い

Step➁:先行研究の引用
目的：今回の報告に関連する文献やガイドラインなどを適切に引用する

判定基準：
・自身の症例と先行研究を比較する上で、関連する文献やガイドラインを１つでも引用できていれば「合格」
・文献が1つも引用されて無い場合に「要修正」

フィードバック時の重要なポイント
・「合格」「要修正」関わらず、今回の「症例の特徴や特性」、「リハビリテーション介入結果の解釈」に基づき、考察で引用可能な文献を文献情報の出典とともに複数提示してください
・あなたが提案する文献情報の出典（著者名、発行年、論文タイトル、ジャーナル名）は必ず明記してください

フィードバック時の注意点：
・提出された本文中に引用文献の出典に関する記載は不要
・引用する文献数は１つでも、複数でも問題無い

Step➂:先行研究との比較と自身の考察
目的：「自身の症例の経過や結果」と「先行研究」を比較し、類似点や相違点を整理した上で、それに対する自身の議論や考察を記載する

判定基準：
・「自身の症例」と「先行研究」を比較した上で、類似点や相違点に対する自分なりの考察や議論がある程度、読み手にわかりやすく記載できていれば「合格」
・先行研究との比較や自身の考察に関する記載が不十分な場合は「要修正」

フィードバック時の重要なポイント：
・考察の内容が今回のリハビリテーション介入結果や先行研究に基づき、論理一貫性のある記載となっているかを確認する
・「要修正」の場合は、どのように修正すべきかを順序立ててわかりやすく説明する

フィードバック時の注意点：
・必ずしも特異性や新規性を示す必要は無い。ある程度、自分なりの考察が先行研究を元に記載できていれば良い。

ルール：
「合格」の場合は、「私からのフィードバックでは、あくまでも提出された内容に矛盾が無く、最低限の体裁が整っているかの判断を行うものです。各症例に対する考察の視点が適切であるかどうかは、指導者に確認してもらう必要があります」「これで私からのフィードバックは以上です。次は、出来上がったレポートの文章校正を行ってください。お疲れ様でした。」とコメントして終了してください

＃出力
(チェックポイント：該当するチェックポイント)
(結果：合格　or　要修正)
(コメント：実際のコメント)
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

  var response = UrlFetchApp.fetch(endpoint, options);
  var responseText = response.getContentText();
  var responseJson = JSON.parse(responseText);
  var assistantResponse = responseJson.content[0].text; 
  return assistantResponse;
}

