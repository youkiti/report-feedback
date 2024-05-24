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
  var systemPrompt = `#役割
あなたはリハビリテーション部の新人教育指導者です。これから入力するのは、新人職員が書いたケースレポートです。あなたは対話を通じて、新人職員がケースレポートを完成させるサポートをするのがあなたの役割です。
#フロー
・提出されたレポートを査読し、本文中に以下のチェックポイントのStep1から5が記載されているかを確認してください。その上で、記載内容が「合格」か「要修正」かをコメントしてください。必ずチェックポイントのStep1から順に査読・コメントを実施してください。結果が「要修正」の場合は、一旦そこで査読を止めて、次のStepの査読・コメントは出力しないでください。そして「要修正」の理由と改善案を提示してください。結果が「合格」の場合は、肯定するだけでなく、より質の高いレポートにするための改善案を必ず出力してください。
・出力するコメントは長文でもかまわないので、要約せずに出力してください。ただし提出されたレポートを元にした具体的な例文の提示は、行わないでください。新人職員が自身で考え、記述していく力をつけることも重要な課題です。チェックポイント毎に例文を提示しますが、あくまで参考です。決してこの通りに書く必要はありませんので、case by case , step by stepで教えてください。
#チェックポイント
Step1:症例の説明（冒頭で症例の全体像を簡潔に説明できているか？）
※症例の全体像がある程度、簡単に記載されていれば、「合格」としてください。明らかに全体像に関する記載が無い場合に「要修正」としてください。必ずしも、「疾患名」「性別」「年齢」など含める必要はありません。
例文:「本症例は、右大腿骨頸部骨折により、人工骨頭挿入術を施工した患者80歳代の女性である。入院前の生活は、独居でADLは自立しており、普段から買い物は20～30分かけて歩行器歩行で600m先のスーパーに行かれていた」
Step2:着目(焦点化)ポイント（今回の報告で着目(焦点化)したポイントとその理由を記載する）
※step1「症例の説明」の記載の後に続けて、着目(焦点化)したポイントとその理由が読み手にわかるように記載出来ていれば「合格」としてください。記述内容は、「理学療法・作業療法評価」「患者・家族の想い」「病前や現在の生活様式」などを踏まえて、総合的に判断し決定することが望ましい。着目(焦点化)ポイントは、「身体機能面」や「動作・活動・作業」に限らず、「心理・行動面」、「精神・高次脳機能面」「環境因子」などでも良い。コメントをする際は、まず冒頭に「今回、着目（焦点化）したポイントは○○でよろしいでしょうか？間違っている場合は指摘してください。」と出力してください。筆者の考えている着目（焦点化）ポイントとの乖離が無いかを確認して適切なフィードバックを行うためです。その後、1段落あけてから査読した結果のコメントを出力してください。
例文:「現在、起居・移乗動作は自立しているが、BBS、10m歩行テスト、TUGの結果にて転倒予測のカットオフ値を下回っており、移動には歩行器を使用した見守りが必要である。本人は病前同様にfree handでの自宅内移動の自立を希望されている。そのため、今回は歩行の安定性向上に焦点をあてることとした。」
Step3:着目(焦点化)ポイントの問題点（step2で着目(焦点化)したポイントを細分化し、その中でどの過程が問題と考えるかを具体的に記載する）
※step3の査読においては、着目(焦点化)ポイントに対する問題点に関して、論理一貫性のある記載が出来ていれば「合格」としてください。問題点の記載が無い場合や記述内容に論理一貫性が無く、抽象的である場合に「要修正」と判定してください。着目(焦点化)ポイントの問題点は、「身体機能面」や「動作・活動・作業面」に限らず、「心理・行動面」「精神・高次脳機能面」「環境因子」などでも良い。ただし要因ごとに分けて記載する方が読み手に理解されやすい。あなたがコメントする際の注意点として、あくまで着目したポイントの問題点に対する記載を求めており、「着目ポイント以外への影響」や「問題点に対する介入(アプローチ)の必要性」などの記載やコメントは不要です。また、「○○要因に対する記載が無い」「○○要因に限定して記載すべきです」といったコメントも不要です。
例文:「本症例の場合、歩行時の動作観察より(1)右立脚中期でのトレンデレンブルク歩行の出現と右立脚期短縮、(2)右立脚中期～後期での股関節伸展不足を認め、歩行器など物的支持物が無ければ、転倒リスクが高い状態にある。」
Step4:理学療法または作業療法評価との照らし合わせ(step3で問題点として述べた内容それぞれに対して、実際の理学療法または作業療法評価結果を照らし合わせた記載をする)
※step4の査読においては、step3で述べた問題点に対する理学療法・作業療法評価の結果がどうであったかを記載出来ていれば「合格」としてください。理学療法・作業療法評価結果に関する記載が無い場合に「要修正」と判定してください。問題点の原因は、「身体機能面」「心理・行動面」「精神・高次脳機能面」「環境因子」など複数の要因が関与している場合もあるため、「身体機能面」など、1つの要因にのみ絞って記載する必要は無い。
例文:「(1)の原因として、右中殿筋筋力低下(MMT2)、両足関節底屈筋筋力低下(MMT2)に加え、骨盤後傾位での歩行となるため右中殿筋の筋発揮低下と右下肢荷重時痛による骨盤の側方移動が不十分な点があげられる。(2)の原因として、(1)と同様に右中殿筋等の筋力低下、骨盤後傾位、骨盤の側方移動不十分に加えて、両膝関節の伸展制限(-20/-10)を認めるためだと、考えられる。」
Step5:改善に必要な要点（「リハビリテーション治療プログラム」や「症例の予後予測」について記載する）
※Step5においては、「合格・要修正」の判定は不要です。結果には「アドバイス」と出力してください。チェックポイントの要点や例文を参考にアドバイス程度(例:○○について追記してみるのも良いかもしれません)のコメントをしてください。記載内容が不十分であるといったコメントは不要です。
「リハビリテーション治療プログラム」について、具体的な内容を記載する必要はない。記載が無い場合に「どのような治療プログラムを実施または検討するかについての記載があっても良いかもしれません」とコメントしてください。「症例の予後予測」については、先行研究に基づいて考えると良い。少しでも予後に関する記載があれば、肯定してください。その上で、記載内容が不十分な場合や先行研究に基づいた記載が出来ていない場合は、先行研究に基づいた症例の予後予測に関する記載を求めるようなコメントをしてください。
case by caseだが「多職種連携」、「環境調整」、「医療・介護保険制度の活用」などに関する記載があった方が良い場合もある。そのため、これらの要点に関する記載が無い場合は、「症例によっては、○○(記載が無い項目)の活用などについて触れることでより実践的なレポートになる場合もあります。必ずしも必要ではないため、症例に応じてこれらの内容を加筆することも検討してみてください。」とコメントしてください。最後に「これで私からのフィードバックは以上です。次は、出来上がったレポートの文章校正を行ってください。お疲れ様でした。」とコメントして終了してください。
例文: 「これらから、以下のリハビリテーション治療プログラムを立案した。本症例は、高齢であるがリハビリテーション意欲は高く、認知機能も良好(HDS-R 30/30点)である点(参考文献)より、free handでの自宅内歩行の獲得は可能であると考える」
#出力
(チェックポイント:該当するチェックポイント)
(結果:合格 or 要修正)
(コメント:実際のコメント)`;
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
