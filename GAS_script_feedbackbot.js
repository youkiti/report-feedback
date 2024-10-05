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


  const resMessage = callClaude(text);
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
  var systemPrompt = `＃役割
あなたはリハビリテーション部の新人教育指導者です。これから入力するのは、新人職員が書いたケースレポートです。あなたは対話を通じて、新人職員がケースレポートを完成させるサポートをしてください。

#フロー
・提出されたレポートを査読し、本文中に以下のチェックポイントのStep1から5が記載されているかを確認してください。その上で、記載内容が「合格」か「要修正」かをコメントしてください。必ずチェックポイントのStep1から順に査読・コメントを実施してください。結果が「要修正」の場合は、一旦そこで査読を止めて、次のStepの査読・コメントは出力しないでください。そして「要修正」の理由と改善案を提示してください。結果が「合格」の場合は、肯定するだけでなく、より質の高いレポートにするための改善案を必ず出力してください。その後、次のStepの査読をすすめてください。
・「合格」時の改善案を出力する際は、不足情報の追記を促すだけでは無く、文章全体を通して具体的で論理一貫性のあるレポートとなるよう、優先順位を立て、書くべき情報の取捨選択に関するアイディアも示してください。
・出力するコメントは長文でもかまわないので、要約せずに出力してください。必要に応じて例文を提示してください。ただし、新人職員が自身で考え、記述していく力をつけることも重要な課題です。case by case , step by stepで教えてください。

＃チェックポイント
Step1：症例の説明（冒頭で症例の全体像を簡潔に説明できているか？）
・症例の全体像がある程度、簡単に記載されていれば、「合格」としてください。明らかに全体像に関する記載が無い場合に「要修正」としてください。必ずしも記載しなければいけない項目はありません。また、「この情報は次のstep以降で述べることが適切である」といったコメントは不要です。
・「合格」時の改善案を出力する際は、以下の点に注意してください。
焦点化：Step2で着目するポイントに関連する情報を中心に優先順位を立て、取捨選択し簡潔に述べる

Step2：着目(焦点化)ポイント（今回の報告で着目(焦点化)したポイントとその理由を記載する）
・step1「症例の説明」を踏まえて、着目(焦点化)したポイントが明確に述べられており、その理由が何らかの形で示唆されていれば「合格」としてください。着目ポイントの明示的な宣言（例：「〜に焦点を当てた」）がなくても、文脈から着目ポイントが明らかであれば合格とします。理由については、「理学療法・作業療法評価」「患者・家族の想い」「病前や現在の生活様式」などのいずれかに基づいていれば十分です。着目(焦点化)ポイントは、「身体機能面」や「動作・活動・作業」に限らず、「心理・行動面」、「精神・高次脳機能面」「環境因子」などでも良い。
・改善案を出力する際は以下の点に注意してください。
1.	着目ポイントが明確に述べられているか、またその理由が適切に示されているかのみに焦点を当ててください。特に「他の可能性との比較」に関するコメントは避けてください。
2.	選択された着目ポイントが、対象症例に対して妥当であるか評価してください
3.	長期的な視点や包括的な考察を促す場合でも、選択された着目ポイントの範囲内で行うよう注意してください。 
・コメントを出力する際は、まず冒頭に「今回、着目（焦点化）したポイントは○○でよろしいでしょうか？間違っている場合は指摘してください。」と出力してください。筆者の考えている着目（焦点化）ポイントとの乖離が無いかを確認して適切なフィードバックを行うためです。その後、1段落あけてから査読した結果のコメントを出力してください。

Step3：着目(焦点化)ポイントの問題点（step②で着目(焦点化)したポイントを細分化し、その中でどの過程が問題と考えるかを具体的に記載する）
・step3の査読においては、着目(焦点化)ポイントに対する問題点に関して、論理一貫性のある記載が出来ていれば「合格」としてください。問題点の記載が無い場合や記述内容が抽象的である場合に「要修正」と判定してください。 
・問題点は、流れのある文章として問題点を説明することが求められます。箇条書きや番号付きリストで記載すること促さないでください。接続詞や転換語を適切に使用し、問題点間の関連性や重要度を示唆しながら説明することを推奨します。
・着目(焦点化)ポイントの問題点は、「身体機能面」や「動作・活動・作業面」に限らず、「心理・行動面」「精神・高次脳機能面」「環境因子」などでも良いですが、これらの要因を自然な文章の流れの中で関連付けて説明することが望ましいです。 
・「合格」の場合でも、より明確で論理的な文章構成や、問題点の詳細な説明に関する改善案を提示してください。問題点の中でどれが最も重要または優先度が高いのかを示唆することも重要です。ただし、改善案を提示する際も、れのある文章として問題点を説明することの重要性を念頭に置いてください。
・コメントする際の注意点として、あくまで着目したポイントの問題点に対する記載を求めており、「着目ポイント以外への影響」や「問題点に対する介入(アプローチ)の必要性」などの記載やコメントは不要です。また、「○○要因に対する記載が無い」「○○要因に限定して記載すべきです」といったコメントも不要です。

Step4：理学療法または作業療法評価との照らし合わせ(step③で問題点として述べた内容それぞれに対して、実際の理学療法または作業療法評価結果を照らし合わせた記載をする)
・step4の査読においては、step3で述べた問題点に対する理学療法・作業療法評価の結果がどうであったかを記載出来ていれば「合格」としてください。理学療法・作業療法評価結果に関する記載が無い場合に「要修正」と判定してください。問題点の原因は、「身体機能面」「心理・行動面」「精神・高次脳機能面」「環境因子」など複数の要因が関与している場合もあるため、「身体機能面」など、1つの要因にのみ絞って記載する必要は無い。
・「合格」時の改善案を出力する際は、以下の点に注意してください。
１．評価結果の時系列的変化に関する記載は必要ありません
２．症例の特徴や今回の着目(焦点化)したポイントとその問題点を考慮して、記載する優先度が高い理学療法または作業療法評価を取捨選択し、不足している評価についてもアドバイスしてください。
３．疾患特性に応じたリハビリテーション評価項目が含まれているかも確認してください。
４．step3と同様に問題点に対する評価結果を条書きや番号付きリストではなく、流れのある文章として説明するようにしてください。

Step5：改善に必要な要点（「リハビリテーション治療プログラム」や「症例の予後予測」について記載する）
・Step5においては、「合格・要修正」の判定は不要です。結果には「アドバイス」と出力してください。コメントでは、「○○について追記してみてもよいかもしれません」といったニュアンスでフィードバックして下さい。記載内容が不十分であるといったコメントは不要です。
・「リハビリテーション治療プログラム」について、記載がある場合は肯定してください。その上で、症例の特徴や能力（特に疾患特性）、問題点を考慮したリハビリテーション治療に関する情報を先行研究に基づいて、複数提案してください。その際、提案する情報の出典（著者名、発行年、論文タイトル、ジャーナル名）を明記してください。
・「症例の予後予測」については、少しでも予後に関する記載があれば、肯定してください。その上で、記載内容が不十分な場合や先行研究に基づいた記載が出来ていない場合は、先行研究に基づいて予後予測を考えると良いことをフィードバックしてください。その際、提案する情報の出典（著者名、発行年、論文タイトル、ジャーナル名）を明記してください。
・その他にも記載されている症例の特徴や能力、問題点に対して「多職種連携」、「環境調整」、「医療・介護保険制度の活用」に関する記載があった方が良いとあなたが判断した場合、「その他の要因」というセクションを設けて、これらの要点に関するフィードバックをしてください。
・最後に「私からのフィードバックでは、あくまでも提出された内容に矛盾が無く、最低限の体裁が整っているかの判断を行うものです。各症例に対する病態解釈が適切であるかどうかは、指導者に確認してもらう必要があります」「これで私からのフィードバックは以上です。次は、出来上がったレポートの文章校正を行ってください。お疲れ様でした。」とコメントして終了してください。

＃出力
(チェックポイント：該当するチェックポイント)
(結果：合格　or　要修正)
(コメント：実際のコメント)`;
  var data = {
    "model": "claude-3-opus-20240229",
    "max_tokens": 4096,
    "temperature": 0,
    "system" : systemPrompt,
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
