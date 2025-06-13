[English](../../CONTRIBUTING.md) • [Català](../ca/CONTRIBUTING.md) • [Deutsch](../de/CONTRIBUTING.md) • [Español](../es/CONTRIBUTING.md) • [Français](../fr/CONTRIBUTING.md) • [हिंदी](../hi/CONTRIBUTING.md) • [Italiano](../it/CONTRIBUTING.md) • [Nederlands](../nl/CONTRIBUTING.md) • [Русский](../ru/CONTRIBUTING.md)

[日本語](../ja/CONTRIBUTING.md) • [한국어](../ko/CONTRIBUTING.md) • [Polski](../pl/CONTRIBUTING.md) • [Português (BR)](../pt-BR/CONTRIBUTING.md) • [Türkçe](../tr/CONTRIBUTING.md) • <b>Tiếng Việt</b> • [简体中文](../zh-CN/CONTRIBUTING.md) • [繁體中文](../zh-TW/CONTRIBUTING.md)

# Đóng góp cho Roo Code

Roo Code là một dự án do cộng đồng dẫn dắt và chúng mình rất trân trọng mọi đóng góp. Để đơn giản hóa quy trình hợp tác, chúng mình áp dụng cách tiếp cận [Issue-First](#cách-tiếp-cận-issue-first), nghĩa là tất cả [Pull Request (PR)](#gửi-pull-request) phải được liên kết với một GitHub Issue trước. Vui lòng đọc kỹ hướng dẫn này.

## Mục lục

- [Trước khi đóng góp](#trước-khi-đóng-góp)
- [Tìm kiếm & lên kế hoạch đóng góp](#tìm-kiếm--lên-kế-hoạch-đóng-góp)
    - [Yêu cầu tính năng vs. Đề xuất tính năng chi tiết](#yêu-cầu-tính-năng-vs-đề-xuất-tính-năng-chi-tiết)
- [Quy trình phát triển & gửi bài](#quy-trình-phát-triển--gửi-bài)
- [Pháp lý](#pháp-lý)

## Trước khi đóng góp

### 1. Quy tắc ứng xử

Tất cả thành viên đóng góp phải tuân thủ [Quy tắc ứng xử](./CODE_OF_CONDUCT.md) của chúng mình.

### 2. Lộ trình phát triển dự án

Lộ trình của chúng mình định hướng dự án. Hãy điều chỉnh đóng góp của bạn theo các mục tiêu chính:

### Độ tin cậy là ưu tiên hàng đầu

- Đảm bảo việc chỉnh sửa diff và thực thi lệnh luôn đáng tin cậy
- Giảm thiểu các điểm cản trở khiến người dùng ngại sử dụng thường xuyên
- Đảm bảo hoạt động mượt mà trên mọi ngôn ngữ và nền tảng
- Mở rộng hỗ trợ mạnh mẽ cho nhiều nhà cung cấp và mô hình AI đa dạng

### Nâng cao trải nghiệm người dùng

- Đơn giản hóa giao diện người dùng để tăng tính rõ ràng và trực quan
- Liên tục cải thiện quy trình làm việc để đáp ứng kỳ vọng cao của các nhà phát triển

### Dẫn đầu về hiệu suất agent

- Thiết lập các tiêu chuẩn đánh giá toàn diện (evals) để đo lường năng suất trong thực tế
- Giúp mọi người dễ dàng chạy và hiểu các đánh giá này
- Cung cấp các cải tiến thể hiện rõ sự tăng trưởng trong điểm đánh giá

Đề cập đến sự liên quan với các lĩnh vực này trong PR của bạn.

### 3. Tham gia cộng đồng Roo Code

- **Cách chính:** Tham gia [Discord](https://discord.gg/roocode) của chúng mình và nhắn tin trực tiếp cho **Hannes Rudolph (`hrudolph`)**.
- **Cách thay thế:** Cộng tác viên có kinh nghiệm có thể tham gia trực tiếp qua [GitHub Projects](https://github.com/orgs/RooCodeInc/projects/1).

## Tìm kiếm & lên kế hoạch đóng góp

### Các loại đóng góp

- **Sửa lỗi:** Khắc phục vấn đề trong mã nguồn.
- **Tính năng mới:** Thêm chức năng mới.
- **Tài liệu:** Cải thiện hướng dẫn và độ rõ ràng.

### Cách tiếp cận Issue-First

Mọi đóng góp đều phải bắt đầu bằng một GitHub Issue.

- **Kiểm tra issue hiện có:** Tìm kiếm trong [GitHub Issues](https://github.com/RooCodeInc/Roo-Code/issues).
- **Tạo issue mới:** Sử dụng mẫu phù hợp:
    - **Lỗi:** Mẫu "Bug Report".
    - **Tính năng:** Mẫu "Detailed Feature Proposal". Cần được phê duyệt trước khi bắt đầu. (Xem [Yêu cầu tính năng vs. Đề xuất tính năng chi tiết](#yêu-cầu-tính-năng-vs-đề-xuất-tính-năng-chi-tiết) bên dưới)
- **Nhận issue:** Bình luận và chờ được gán chính thức.

**PR không có issue đã duyệt có thể bị đóng.**

### Quyết định việc cần làm

- Xem [Dự án GitHub](https://github.com/orgs/RooCodeInc/projects/1) để tìm "Good First Issues" chưa được gán.
- Về tài liệu, hãy xem [Roo Code Docs](https://github.com/RooCodeInc/Roo-Code-Docs).

### Báo cáo lỗi

- Kiểm tra báo cáo hiện có trước.
- Tạo báo cáo lỗi mới bằng [mẫu "Bug Report"](https://github.com/RooCodeInc/Roo-Code/issues/new/choose).
- **Lỗ hổng bảo mật:** Báo cáo riêng qua [security advisories](https://github.com/RooCodeInc/Roo-Code/security/advisories/new).

### Yêu cầu tính năng vs. Đề xuất tính năng chi tiết

Hiểu rõ sự khác biệt giữa hai loại gửi bài này rất quan trọng để chọn cách tiếp cận đúng:

#### Yêu cầu tính năng (GitHub Discussions)

**Mục đích**: Chia sẻ ý tưởng hoặc đề xuất chung mà không cần lập kế hoạch chi tiết.

**Cách gửi**:

- Điều hướng đến [GitHub Discussions - Feature Requests](https://github.com/RooCodeInc/Roo-Code/discussions/categories/feature-requests)
- Hoặc nhấp vào liên kết "Feature Request" khi nhấn nút "New Issue" trong phần issues

**Sử dụng khi**:

- Ý tưởng của bạn chưa được phát triển đầy đủ
- Bạn muốn nhận ý kiến hoặc phản hồi từ cộng đồng
- Bạn đang đề xuất ý tưởng mà không có kế hoạch tự mình thực hiện

#### Đề xuất tính năng chi tiết (GitHub Issues)

**Mục đích**: Các tính năng được phác thảo rõ ràng nhằm triển khai ngay sau khi được phê duyệt.

**Cách gửi**:

- Điều hướng đến [GitHub Issues](https://github.com/RooCodeInc/Roo-Code/issues)
- Nhấp vào "New Issue" và chọn mẫu "Detailed Feature Proposal"

**Sử dụng khi**:

- Tính năng của bạn đã được lập kế hoạch đầy đủ và sẵn sàng để phê duyệt
- Bạn hoặc người khác có ý định triển khai tính năng sớm
- Cần phê duyệt chính thức trước khi bắt đầu phát triển

**Lưu ý**: Đề xuất tính năng chi tiết phải được phê duyệt và gán bởi người duy trì trước khi bắt đầu triển khai, như đã đề cập trong phần [Cách tiếp cận Issue-First](#cách-tiếp-cận-issue-first) ở trên.

![Lựa chọn mẫu Issue](placeholder-for-issue-template-selection-image)

**Quan trọng**: Chọn sai mẫu có thể khiến bài gửi của bạn bị chuyển hướng hoặc đóng. Không sử dụng Báo cáo lỗi cho ý tưởng tính năng.

## Quy trình phát triển & gửi bài

### Thiết lập môi trường phát triển

1. **Fork & Clone:**

```
git clone https://github.com/TEN_TAI_KHOAN/Roo-Code.git
```

2. **Cài đặt phụ thuộc:**

```
npm run install:all
```

3. **Debug:** Mở bằng VS Code (`F5`).

### Hướng dẫn viết mã

- Mỗi PR chỉ tập trung vào một tính năng hoặc sửa lỗi.
- Tuân thủ các thực hành tốt nhất của ESLint và TypeScript.
- Viết thông điệp commit rõ ràng, tham chiếu đến issue (ví dụ: `Fixes #123`).
- Cung cấp bài kiểm tra đầy đủ (`npm test`).
- Rebase trên nhánh `main` mới nhất trước khi gửi.

### Gửi Pull Request

- Bắt đầu với **PR nháp** nếu muốn nhận phản hồi sớm.
- Mô tả rõ ràng các thay đổi, tuân theo Mẫu Pull Request.
- Cung cấp ảnh chụp/video cho thay đổi UI.
- Chỉ rõ nếu cần cập nhật tài liệu.

### Chính sách Pull Request

- Phải tham chiếu đến issue đã được phê duyệt và gán.
- PR không tuân thủ chính sách có thể bị đóng.
- PR cần vượt qua kiểm tra CI, phù hợp với lộ trình và có tài liệu rõ ràng.

### Quy trình đánh giá

- **Phân loại hàng ngày:** Kiểm tra nhanh bởi maintainer.
- **Đánh giá chi tiết hàng tuần:** Đánh giá toàn diện.
- **Lặp lại nhanh chóng** dựa trên phản hồi.

## Pháp lý

Khi gửi pull request, bạn đồng ý rằng đóng góp của mình sẽ được cấp phép theo Giấy phép Apache 2.0, phù hợp với giấy phép của Roo Code.
