const axios = require('axios');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk'); // Nhập chalk để cải thiện việc ghi nhật ký

// Tải cookie từ tệp cookies.txt, loại bỏ khoảng trắng ở mỗi dòng cookie
const loadCookies = () => {
  return fs.readFileSync(path.resolve(__dirname, 'cookies.txt'), 'utf8')
    .split('\n') // Chia nội dung tệp theo dòng mới
    .map(cookie => cookie.trim()) // Loại bỏ khoảng trắng ở mỗi dòng cookie
    .filter(cookie => cookie.length > 0); // Loại bỏ các dòng trống
};

// Hàm hỗ trợ kiểm tra xem một ngày có phải là hôm nay theo UTC không
const isToday = (date) => {
  const today = new Date();
  // Lấy ngày hôm nay theo UTC (năm, tháng, ngày)
  const todayUTC = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  // Đặt thời gian của ngày được truyền vào thành nửa đêm UTC
  const dateUTC = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  
  return dateUTC.getTime() === todayUTC.getTime(); // So sánh xem ngày có khớp với ngày hôm nay không (bỏ qua thời gian)
};

// Kiểm tra xem người dùng đã tung xúc xắc cho nhiệm vụ vào ngày hôm nay chưa
const hasRolledDice = async (cookies) => {
  const url = 'https://www.magicnewton.com/portal/api/userQuests';

  try {
    const response = await axios.get(url, {
      headers: {
        'Cookie': cookies, // Truyền cookie cụ thể cho tài khoản
        'Content-Type': 'application/json'
      }
    });

    // Lọc theo questId cụ thể và kiểm tra xem đã tung xúc xắc hôm nay chưa
    const questId = 'f56c760b-2186-40cb-9cbc-3af4a3dc20e2';
    const questCompletedToday = response.data.data.some(quest => 
      quest.questId === questId && 
      quest.status === 'COMPLETED' &&
      isToday(new Date(quest.createdAt)) // Kiểm tra xem createdAt có phải là ngày hôm nay theo UTC không
    );

    return questCompletedToday; // Trả về true nếu nhiệm vụ đã hoàn thành hôm nay cho người dùng này
  } catch (error) {
    console.error(chalk.red('Lỗi khi kiểm tra xem người dùng đã tung xúc xắc:', error.message));
    return false; // Trả về false nếu có lỗi
  }
};

// Hàm tung xúc xắc cho từng tài khoản
const rollDice = async (cookies, index) => {
  const questId = 'f56c760b-2186-40cb-9cbc-3af4a3dc20e2';

  // Đầu tiên kiểm tra xem người dùng đã tung xúc xắc hôm nay chưa
  const alreadyRolled = await hasRolledDice(cookies);

  if (alreadyRolled) {
    console.log(chalk.yellow(`Tài khoản #${index + 1} đã tung xúc xắc hôm nay, bỏ qua.`));
    return;
  }

  const url = 'https://www.magicnewton.com/portal/api/userQuests';
  const payload = {
    questId: questId,
    metadata: {}
  };

  try {
    const response = await axios.post(url, payload, {
      headers: {
        'Cookie': cookies, // Truyền cookie cụ thể cho tài khoản
        'Content-Type': 'application/json'
      }
    });

    // Kiểm tra xem nhiệm vụ đã hoàn thành chưa và in số tín dụng nhận được
    if (response.data.message === "Quest completed") {
      const creditsReceived = response.data.data.credits;
      console.log(chalk.green(`Nhiệm vụ hoàn thành cho tài khoản #${index + 1}, Tín dụng nhận được: ${creditsReceived}`));
    } else {
      console.log(chalk.red('Lỗi cho tài khoản #', index + 1));
      console.log(chalk.red('Thông báo lỗi:', response.data.message));
    }
  } catch (error) {
    // Ghi lại phản hồi lỗi chi tiết nếu yêu cầu thất bại
    if (error.response) {
      console.error(chalk.red('Trạng thái phản hồi lỗi cho tài khoản #', index + 1, ':', error.response.status));
      console.error(chalk.red('Dữ liệu phản hồi lỗi:', error.response.data));
    } else {
      console.error(chalk.red('Thông báo lỗi cho tài khoản #', index + 1, ':', error.message));
    }
  }
};

// Hàm tính toán khoảng thời gian giữa hiện tại và lần chạy tiếp theo
const calculateNextRunTime = (latestCreatedAt) => {
  const nextRunTime = new Date(latestCreatedAt);
  nextRunTime.setHours(nextRunTime.getHours() + 24); // Thêm 24 giờ
  nextRunTime.setMinutes(nextRunTime.getMinutes() + 5); // Thêm 5 phút

  const now = new Date();
  const timeDifference = nextRunTime - now; // Tính khoảng cách giữa hiện tại và thời gian chạy tiếp theo

  return { timeDifference, nextRunTime };
};

// Tải tất cả cookie (mỗi dòng đại diện cho một tài khoản)
const cookiesList = loadCookies();

// Chạy lần đầu tiên cho từng tài khoản ngay lập tức
cookiesList.forEach((cookies, index) => rollDice(cookies, index));

// Sau khi tung xúc xắc xong, lấy thời gian `createdAt` mới nhất từ tất cả cookie
const getLatestCreatedAt = async () => {
  const createdAtList = [];

  for (let index = 0; index < cookiesList.length; index++) {
    const cookies = cookiesList[index];
    const url = 'https://www.magicnewton.com/portal/api/userQuests';

    try {
      const response = await axios.get(url, {
        headers: {
          'Cookie': cookies,
          'Content-Type': 'application/json'
        }
      });

      // Lọc dữ liệu mới nhất theo questId và lấy thời gian createdAt mới nhất
      const latestQuest = response.data.data.filter(quest => quest.questId === 'f56c760b-2186-40cb-9cbc-3af4a3dc20e2')
                                             .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0]; // Sắp xếp theo createdAt, giảm dần

      if (latestQuest) {
        createdAtList.push(new Date(latestQuest.createdAt)); // Thu thập `createdAt` mới nhất
      }
    } catch (error) {
      console.error(chalk.red(`Lỗi khi lấy dữ liệu cho tài khoản #${index + 1}:`, error.message));
    }
  }

  if (createdAtList.length > 0) {
    // Sắp xếp danh sách các mốc thời gian theo thứ tự giảm dần (mới nhất trước)
    const sortedCreatedAtList = createdAtList.sort((a, b) => b - a);

    // Tìm ngày `createdAt` mới nhất từ tất cả tài khoản
    const latestCreatedAt = sortedCreatedAtList[0];
    const { timeDifference, nextRunTime } = calculateNextRunTime(latestCreatedAt);

    // Chỉ hiển thị giá trị phút dưới dạng số nguyên
    const minutes = Math.round(timeDifference / 1000 / 60); // Chuyển đổi mili giây sang phút

    console.log(chalk.blue(`Lần chạy tiếp theo sẽ được lên lịch vào ${nextRunTime}.`));
    console.log(chalk.blue(`Script sẽ chạy lại sau ${minutes} phút.`));

    // Đặt khoảng thời gian tiếp theo linh hoạt dựa trên chênh lệch thời gian
    setTimeout(async () => {
      await processAllAccounts();
    }, timeDifference);
  }
};

// Hàm in tiêu đề
function printHeader() {
    const line = "=".repeat(50);
    const title = "Tự Động Tung Xúc Xắc Hàng Ngày";
    const createdBy = "Bot được tạo bởi: https://t.me/zero2hero100x";

    const totalWidth = 50;
    const titlePadding = Math.floor((totalWidth - title.length) / 2);
    const createdByPadding = Math.floor((totalWidth - createdBy.length) / 2);

    const centeredTitle = title.padStart(titlePadding + title.length).padEnd(totalWidth);
    const centeredCreatedBy = createdBy.padStart(createdByPadding + createdBy.length).padEnd(totalWidth);

    console.log(chalk.cyan.bold(line));
    console.log(chalk.cyan.bold(centeredTitle));
    console.log(chalk.green(centeredCreatedBy));
    console.log(chalk.cyan.bold(line));
}

printHeader();
// Ghi lại thời gian mà script sẽ chạy lại sau khi hoàn thành tất cả các lần tung xúc xắc
getLatestCreatedAt();

// Xử lý tuần tự tất cả các tài khoản (chờ hoàn thành mỗi lần tung xúc xắc)
const processAllAccounts = async () => {
  for (let index = 0; index < cookiesList.length; index++) {
    await rollDice(cookiesList[index], index); // Chờ mỗi lần tung xúc xắc hoàn thành trước khi tiếp tục
  }

  // Sau khi tất cả các lần tung xúc xắc hoàn tất, lấy lại thời gian `createdAt` mới nhất
  await getLatestCreatedAt();
};