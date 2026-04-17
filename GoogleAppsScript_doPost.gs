/**
 * ГЛАВНЫЙ СКРИПТ ДЛЯ ОБРАБОТКИ ДАННЫХ ИЗ TELEGRAM MINI APP
 * Обновлено под актуальную структуру данных (rental без смен/скриншота, inspection — 4 фото по сторонам).
 */

function doPost(e) {
  var sheetId = '1auIYoHsa4DPkG3LLNeyNAhD8NcbqorYmztQEcYAHojE';
  var ss = SpreadsheetApp.openById(sheetId);
  var logSheet = ss.getSheetByName('Log') || ss.insertSheet('Log');

  try {
    if (!e || !e.postData || !e.postData.contents) {
      return createResponse({"status": "error", "message": "No data"});
    }

    var data = JSON.parse(e.postData.contents);
    var username = data.username || "Anon";
    var visitorUserId = data.userId ? String(data.userId).trim() : '';
    var safePhone = data.phone ? (String(data.phone).indexOf("'") === 0 ? data.phone : "'" + data.phone) : "—";

    // Сохраняет массив Base64-фото в папку (подпапка по subFolderName)
    function saveToFolder(photoArray, mainFolderName, subFolderName, filePrefix) {
      if (!photoArray || (Array.isArray(photoArray) && photoArray.length === 0)) return "Brak zdjęć";
      var mainFolders = DriveApp.getFoldersByName(mainFolderName);
      var mainFolder = mainFolders.hasNext() ? mainFolders.next() : DriveApp.createFolder(mainFolderName);
      var subFolders = mainFolder.getFoldersByName(subFolderName);
      var subFolder = subFolders.hasNext() ? subFolders.next() : mainFolder.createFolder(subFolderName);
      subFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      var photos = Array.isArray(photoArray) ? photoArray : [photoArray];
      photos.forEach(function(base64, index) {
        try {
          if (!base64) return;
          var cleanBase64 = String(base64).split(',')[1] || base64;
          var blob = Utilities.newBlob(Utilities.base64Decode(cleanBase64), 'image/jpeg',
            filePrefix + "_" + (index + 1) + "_" + new Date().getTime() + ".jpg");
          subFolder.createFile(blob);
        } catch (err) {
          logSheet.appendRow([new Date(), "Błąd zdjęcia", err.toString()]);
        }
      });
      return subFolder.getUrl();
    }

    // Сохраняет фото завершения аренды (front, right, rear, left, interior) в одну папку по номеру ТС
    function saveInspectionPhotos(photoFront, photoRight, photoRear, photoLeft, photoInterior, vehicleNum) {
      var mainFolders = DriveApp.getFoldersByName("Ogledziny_Pojazdow");
      var mainFolder = mainFolders.hasNext() ? mainFolders.next() : DriveApp.createFolder("Ogledziny_Pojazdow");
      var subFolders = mainFolder.getFoldersByName(vehicleNum);
      var subFolder = subFolders.hasNext() ? subFolders.next() : mainFolder.createFolder(vehicleNum);
      subFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      var names = ["front", "right", "rear", "left", "interior"];
      var photos = [photoFront, photoRight, photoRear, photoLeft, photoInterior];
      for (var i = 0; i < photos.length; i++) {
        try {
          if (!photos[i]) continue;
          var base64 = photos[i];
          var cleanBase64 = String(base64).split(',')[1] || base64;
          var blob = Utilities.newBlob(Utilities.base64Decode(cleanBase64), 'image/jpeg',
            names[i] + "_" + new Date().getTime() + ".jpg");
          subFolder.createFile(blob);
        } catch (err) {
          logSheet.appendRow([new Date(), "Błąd zdjęcia " + names[i], err.toString()]);
        }
      }
      return subFolder.getUrl();
    }

    // ==========================================
    // 0. ПОСЕТИТЕЛИ (VISITOR) — только новые пользователи
    // ==========================================
    if (data.type === 'visitor') {
      if (!visitorUserId) {
        logSheet.appendRow([new Date(), 'VISITOR WITHOUT USER ID', username]);
        return createResponse({"status": "error", "message": "Missing userId"});
      }

      var visitorsSheet = ss.getSheetByName('Visitors') || ss.insertSheet('Visitors');
      if (visitorsSheet.getLastRow() === 0) {
        visitorsSheet.appendRow(['TG ID', 'Nickname', 'Time']);
      }

      var lastRow = visitorsSheet.getLastRow();
      var existingIds = lastRow > 1 ? visitorsSheet.getRange(2, 1, lastRow - 1, 1).getValues() : [];
      var exists = existingIds.some(function(row) {
        return String(row[0]).trim() === visitorUserId;
      });

      if (!exists) {
        visitorsSheet.appendRow([visitorUserId, username, new Date()]);
      }
    }

    // ==========================================
    // 0.1 ПОСЕТИТЕЛИ (VISITOR_ALL) — каждый вход
    // ==========================================
    else if (data.type === 'visitor_all') {
      if (!visitorUserId) {
        logSheet.appendRow([new Date(), 'VISITOR_ALL WITHOUT USER ID', username]);
        return createResponse({"status": "error", "message": "Missing userId"});
      }

      var visitorsAllSheet = ss.getSheetByName('VisitorsAll') || ss.insertSheet('VisitorsAll');
      if (visitorsAllSheet.getLastRow() === 0) {
        visitorsAllSheet.appendRow(['Time', 'TG Nick', 'TG ID']);
      }

      visitorsAllSheet.appendRow([new Date(), username, visitorUserId]);
    }

    // ==========================================
    // 1. АРЕНДА (RENTAL) — без смен и скриншота
    // ==========================================
    else if (data.type === 'rental') {
      var sheet = ss.getSheetByName('Rentals') || ss.insertSheet('Rentals');
      if (sheet.getLastRow() === 0) {
        sheet.appendRow(['Дата', 'TG Nick', 'TG ID', 'Pojazd', 'Imię i Nazwisko', 'Telefon', 'Okres']);
      }
      sheet.appendRow([new Date(), username, visitorUserId, data.vehicle || '', data.name || '', safePhone, data.period || '']);
    }

    // ==========================================
    // 2. ЗАВЕРШЕНИЕ / ОСМОТР (INSPECTION) — 4 фото: przód, prawo, tył, lewo
    // ==========================================
    else if (data.type === 'inspection') {
      var sheet = ss.getSheetByName('Inspections') || ss.insertSheet('Inspections');
      if (sheet.getLastRow() === 0) {
        sheet.appendRow(['Дата', 'TG Nick', 'Imię i Nazwisko', 'Telefon', 'Pojazd', 'Numer rej. / id roweru', 'Przebieg (km)', 'Zdjęcia (Link)']);
      }
      var vehicleNum = (data.vehicleNumber || "Unknown").toString().toUpperCase().replace(/\s+/g, '_');
      var inspectUrl = saveInspectionPhotos(
        data.photoFront || '',
        data.photoRight || '',
        data.photoRear || '',
        data.photoLeft || '',
        data.photoInterior || '',
        vehicleNum
      );
      sheet.appendRow([
        new Date(),
        username,
        data.fullName || '',
        safePhone,
        data.vehicle || '',
        vehicleNum,
        data.mileage || '',
        inspectUrl
      ]);
    }

    // ==========================================
    // 3. АВАРИЯ (ISSUE) — fullName, vehicle, photoOswiadczenie, photoScene
    // ==========================================
    else if (data.type === 'issue') {
      var sheet = ss.getSheetByName('Issues') || ss.insertSheet('Issues');
      if (sheet.getLastRow() === 0) {
        sheet.appendRow(['Дата', 'TG Nick', 'Imię i Nazwisko', 'Telefon', 'Pojazd', 'Numer rej. / id roweru', 'Opis', 'Oświadczenie (Link)', 'Zdjęcia miejsca (Link)']);
      }
      var vehicleNum = (data.vehicleNumber || "Unknown").toString().toUpperCase().replace(/\s+/g, '_');
      var oswiadczenieUrl = saveToFolder(data.photoOswiadczenie, "Wypadki_Oswiadczenia", vehicleNum, "Oswiadczenie");
      var sceneUrl = saveToFolder(data.photoScene, "Wypadki_Zdjecia_Miejsca", vehicleNum, "Miejsce");
      sheet.appendRow([
        new Date(),
        username,
        data.fullName || '',
        safePhone,
        data.vehicle || '',
        vehicleNum,
        data.description || '',
        oswiadczenieUrl,
        sceneUrl
      ]);
    }

    // ==========================================
    // 4. ЗАКАЗ АКСЕССУАРОВ (ORDER)
    // ==========================================
    else if (data.type === 'order') {
      var sheet = ss.getSheetByName('Orders') || ss.insertSheet('Orders');
      if (sheet.getLastRow() === 0) {
        sheet.appendRow(['Дата', 'TG Nick', 'Produkt', 'Imię', 'Nazwisko', 'Telefon', 'Adres pracy', 'InPost Kod']);
      }
      sheet.appendRow([
        new Date(),
        username,
        data.item || '—',
        data.firstName || '—',
        data.lastName || '—',
        safePhone,
        data.workLocation || '—',
        data.inpostCode || '—'
      ]);
    }

    // ==========================================
    // 5. СЕРВИС АВТО (SERVICE)
    // ==========================================
    else if (data.type === 'service') {
      var sheet = ss.getSheetByName('Services') || ss.insertSheet('Services');
      if (sheet.getLastRow() === 0) {
        sheet.appendRow(['Дата', 'TG Nick', 'Imię i Nazwisko', 'Telefon', 'Adres Dark Store', 'Numer rej. / id roweru', 'Opis problemu', 'Zdjęcie problemu (Link)']);
      }
      var vehicleNum = (data.vehicleNumber || "Unknown").toString().toUpperCase().replace(/\s+/g, '_');
      var photoProblemUrl = saveToFolder(data.photoProblem || '', "Serwisy_Auto_Zdjecia", vehicleNum, "Problem");
      sheet.appendRow([
        new Date(),
        username,
        data.fullName || '',
        safePhone,
        data.darkStoreAddress || '—',
        vehicleNum,
        data.description || '',
        photoProblemUrl
      ]);
    }

    else {
      logSheet.appendRow([new Date(), 'UNKNOWN TYPE', String((data && data.type) != null ? data.type : '(missing)')]);
      return createResponse({"status": "error", "message": "Unknown type: " + String(data && data.type)});
    }

    return createResponse({"status": "success"});

  } catch (error) {
    logSheet.appendRow([new Date(), "CRITICAL ERROR", error.toString()]);
    return createResponse({"status": "error", "message": error.toString()});
  }
}

function createResponse(contents) {
  return ContentService.createTextOutput(JSON.stringify(contents))
    .setMimeType(ContentService.MimeType.JSON);
}
