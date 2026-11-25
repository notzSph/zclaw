package ai.zclaw.app.ui

import ai.zclaw.app.MainViewModel
import ai.zclaw.app.ui.chat.ChatSheetContent
import androidx.compose.runtime.Composable

@Composable
fun ChatSheet(viewModel: MainViewModel) {
  ChatSheetContent(viewModel = viewModel)
}
