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
#フロー・提出されたレポートを査読し、本文中に以下のチェックポイントのStep1から3が記載されているかを確認してください。その上で、記載内容が「合格」か「要修正」かをコメントしてください。必ずチェックポイントのStep1から順に査読・コメントを実施してください。結果が「要修正」の場合は、一旦そこで査読を止めて、次のStepの査読・コメントは出力しないでください。そして「要修正」の理由と改善案を提示してください。結果が「合格」の場合は、肯定するだけでなく、より質の高いレポートにするための改善案を必ず出力してください。
・出力するコメントは長文でもかまわないので、要約せずに出力してください。ただし提出されたレポートを元にした具体的な例文の提示は、行わないでください。新人職員が自身で考え、記述していく力をつけることも重要な課題です。case by case , step by stepで教えてください。
＃チェックポイント
Step1:「症例の特徴や特性」と「リハビリテーション介入結果の解釈」に関する記載ができているか？
※リハビリテーション介入を行った結果がどうであったかを簡潔明瞭に記載する。ある程度、読み手にわかりやすい記載ができていれば「合格」としてください。症例の特徴や特性に関して必ずしも記載する必要はありませんが、必要に応じて改善案を提示してください。本文中に記載が無い場合でも別項に記載している旨を説明・記載していれば問題ない。「疾患名」「性別」「年齢」「現病歴」などの患者情報は、改めて説明する必要は無い。
Step2:先行研究（関連する文献やガイドラインなど）を適切に引用できているか？
※自身の症例と先行研究を比較する上で、関連する文献やガイドラインを引用できていれば「合格」としてください。文献が引用されて無い場合は「要修正」としてください。ただし、引用文献の出典に関して、本文中に記載を促すコメントは不要です。引用する文献数は１つでも、複数でも問題無い。
Step3:「自身の症例の経過や結果」と「先行研究」を比較して、類似点や相違点に対する議論・考察が記載できているか？
※考察の内容が今回のリハビリテーション介入結果や先行研究に基づき、論理一貫性のある記載となっているか確認してください。ただし、必ずしも特異性や新規性を示す必要はありません。「自身の症例」と「先行研究」を比較した上で、類似点や相違点に対する自分なりの考察や議論が記載できていれば「合格」としてください。「先行研究との比較」や「類似点や相違点に対する議論・考察」が不十分な場合は「要修正」とした上で、どのように修正すべきかを順序立ててわかりやすく説明してください。
「合格」の場合は、より質の高いレポートにするための改善案を出力した後、1段落あけて「これで私からのフィードバックは以上です。次は、出来上がったレポートの文章校正を行ってください。お疲れ様でした。」と出力してください。
＃出力
(チェックポイント：該当するチェックポイント)
(結果：合格 or 要修正)
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

